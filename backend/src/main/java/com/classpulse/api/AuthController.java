package com.classpulse.api;

import com.classpulse.api.dto.AuthDtos.*;
import com.classpulse.config.JwtProvider;
import com.classpulse.config.SecurityUtil;
import com.classpulse.domain.invite.RegistrationCode;
import com.classpulse.domain.invite.RegistrationCodeRepository;
import com.classpulse.domain.user.User;
import com.classpulse.domain.user.UserService;
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

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody LoginRequest request) {
        User user;
        try {
            user = userService.findByIdentifier(request.email());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        if (!userService.checkPassword(user, request.password())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        String token = jwtProvider.generateToken(
                user.getId(),
                user.getEmail(),
                List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()))
        );

        return ResponseEntity.ok(new AuthResponse(token, UserDto.from(user)));
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@RequestBody RegisterRequest request) {
        User.Role role;
        try {
            role = User.Role.valueOf(request.role().toUpperCase());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
        RegistrationCode inviteCode = null;
        if (role == User.Role.OPERATOR) {
            if (request.inviteCode() == null || request.inviteCode().isBlank()) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(null);
            }
            inviteCode = registrationCodeRepository.findByCode(request.inviteCode().trim())
                    .orElse(null);
            if (inviteCode == null || !inviteCode.isValid()) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(null);
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
