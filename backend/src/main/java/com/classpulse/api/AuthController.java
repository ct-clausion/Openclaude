package com.classpulse.api;

import com.classpulse.api.dto.AuthDtos.*;
import com.classpulse.config.AuthRateLimiter;
import com.classpulse.config.JwtBlocklist;
import com.classpulse.config.JwtProvider;
import com.classpulse.config.SecurityUtil;
import com.classpulse.domain.invite.RegistrationCode;
import com.classpulse.domain.invite.RegistrationCodeRepository;
import com.classpulse.domain.user.User;
import com.classpulse.domain.user.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserService userService;
    private final JwtProvider jwtProvider;
    private final RegistrationCodeRepository registrationCodeRepository;
    private final AuthRateLimiter rateLimiter;
    private final JwtBlocklist jwtBlocklist;

    private ResponseEntity<Map<String, String>> error(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(Map.of("error", message));
    }

    /**
     * Pre-computed bcrypt hash of a random throwaway value. Used to burn roughly the
     * same CPU as a real password check when the user lookup fails — keeps response
     * times flat and defeats account-enumeration via timing.
     */
    private static final String DUMMY_HASH =
            "$2a$10$7EqJtq98hPqEX7fNZaFWoOeN7Z7Z7Z7Z7Z7Z7Z7Z7Z7Z7Z7Z7Z7Ze";

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        if (!rateLimiter.tryAcquire(httpRequest)) {
            return error(HttpStatus.TOO_MANY_REQUESTS, "로그인 시도 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.");
        }

        User user;
        try {
            user = userService.findByIdentifier(request.email());
        } catch (IllegalArgumentException e) {
            // Still run a password check against a dummy hash so response timing
            // does not reveal whether the email exists.
            userService.matchesDummy(request.password(), DUMMY_HASH);
            return error(HttpStatus.UNAUTHORIZED, "이메일 또는 비밀번호가 올바르지 않습니다.");
        }
        if (!userService.checkPassword(user, request.password())) {
            return error(HttpStatus.UNAUTHORIZED, "이메일 또는 비밀번호가 올바르지 않습니다.");
        }

        String token = jwtProvider.generateToken(
                user.getId(),
                user.getEmail(),
                List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()))
        );

        return ResponseEntity.ok(new AuthResponse(token, UserDto.from(user)));
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest request, HttpServletRequest httpRequest) {
        if (!rateLimiter.tryAcquire(httpRequest)) {
            return error(HttpStatus.TOO_MANY_REQUESTS, "가입 시도 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.");
        }
        User.Role role;
        try {
            role = User.Role.valueOf(request.role().toUpperCase());
        } catch (IllegalArgumentException e) {
            return error(HttpStatus.BAD_REQUEST, "유효하지 않은 역할입니다.");
        }
        RegistrationCode inviteCode = null;
        if (role == User.Role.OPERATOR || role == User.Role.INSTRUCTOR) {
            if (request.inviteCode() == null || request.inviteCode().isBlank()) {
                return error(HttpStatus.FORBIDDEN, "초대 코드가 필요합니다.");
            }
            inviteCode = registrationCodeRepository.findByCode(request.inviteCode().trim())
                    .orElse(null);
            if (inviteCode == null || !inviteCode.isValid()) {
                return error(HttpStatus.FORBIDDEN, "초대 코드가 유효하지 않거나 만료되었습니다.");
            }
            // Role-binding check: an INSTRUCTOR code cannot be used to register as OPERATOR, etc.
            if (!role.name().equals(inviteCode.getTargetRole())) {
                return error(HttpStatus.FORBIDDEN, "이 초대 코드는 요청한 역할로 사용할 수 없습니다.");
            }
        }

        User user = userService.register(request.email(), request.password(), request.name(), role);

        if (inviteCode != null) {
            inviteCode.setIsUsed(true);
            inviteCode.setUsedBy(user);
            inviteCode.setUsedAt(LocalDateTime.now());
            registrationCodeRepository.save(inviteCode);
        }

        String token = jwtProvider.generateToken(
                user.getId(),
                user.getEmail(),
                List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()))
        );

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new AuthResponse(token, UserDto.from(user)));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest httpRequest) {
        String header = httpRequest.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            try {
                long exp = jwtProvider.extractExpiration(token);
                jwtBlocklist.revoke(token, exp);
            } catch (Exception ignored) {
                // Invalid/expired token — nothing to revoke, succeed silently.
            }
        }
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public ResponseEntity<UserDto> me() {
        Long userId = SecurityUtil.getCurrentUserId();
        User user = userService.findById(userId);
        return ResponseEntity.ok(UserDto.from(user));
    }

    @PutMapping("/password")
    public ResponseEntity<Void> changePassword(@RequestBody Map<String, String> body) {
        Long userId = SecurityUtil.getCurrentUserId();
        User user = userService.findById(userId);
        String currentPassword = body.get("currentPassword");
        String newPassword = body.get("newPassword");
        if (currentPassword == null || newPassword == null) {
            return ResponseEntity.badRequest().build();
        }
        if (!userService.checkPassword(user, currentPassword)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        userService.updatePassword(user, newPassword);
        return ResponseEntity.noContent().build();
    }
}
