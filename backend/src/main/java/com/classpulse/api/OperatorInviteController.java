package com.classpulse.api;

import com.classpulse.config.SecurityUtil;
import com.classpulse.domain.invite.RegistrationCode;
import com.classpulse.domain.invite.RegistrationCodeRepository;
import com.classpulse.domain.user.User;
import com.classpulse.domain.user.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@org.springframework.security.access.prepost.PreAuthorize("hasRole('OPERATOR')")
@RequestMapping("/api/operator/invite-codes")
@RequiredArgsConstructor
@Transactional
public class OperatorInviteController {

    private final RegistrationCodeRepository registrationCodeRepository;
    private final UserService userService;

    public record InviteCodeResponse(
            Long id, String code, String createdByName,
            boolean isUsed, String usedByName, String targetRole,
            LocalDateTime expiresAt, LocalDateTime createdAt, LocalDateTime usedAt
    ) {
        public static InviteCodeResponse from(RegistrationCode rc) {
            return new InviteCodeResponse(
                    rc.getId(),
                    rc.getCode(),
                    rc.getCreatedBy() != null ? rc.getCreatedBy().getName() : null,
                    rc.getIsUsed(),
                    rc.getUsedBy() != null ? rc.getUsedBy().getName() : null,
                    rc.getTargetRole(),
                    rc.getExpiresAt(),
                    rc.getCreatedAt(),
                    rc.getUsedAt()
            );
        }
    }

    public record CreateInviteRequest(Integer expiryDays, String targetRole) {}

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<InviteCodeResponse>> list() {
        List<InviteCodeResponse> codes = registrationCodeRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(InviteCodeResponse::from)
                .toList();
        return ResponseEntity.ok(codes);
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> create(@RequestBody(required = false) CreateInviteRequest request) {
        Long userId = SecurityUtil.getCurrentUserId();
        User operator = userService.findById(userId);

        int expiryDays = (request != null && request.expiryDays() != null) ? request.expiryDays() : 7;
        if (expiryDays < 1 || expiryDays > 90) {
            return ResponseEntity.badRequest().body(Map.of("error", "expiryDays must be between 1 and 90"));
        }

        // Default to INSTRUCTOR (most common use case); operator codes must be explicit.
        String targetRole = (request != null && request.targetRole() != null && !request.targetRole().isBlank())
                ? request.targetRole().toUpperCase()
                : "INSTRUCTOR";
        if (!"INSTRUCTOR".equals(targetRole) && !"OPERATOR".equals(targetRole)) {
            return ResponseEntity.badRequest().body(Map.of("error", "targetRole must be INSTRUCTOR or OPERATOR"));
        }

        String code = UUID.randomUUID().toString().substring(0, 8).toUpperCase();

        RegistrationCode rc = RegistrationCode.builder()
                .code(code)
                .createdBy(operator)
                .isUsed(false)
                .targetRole(targetRole)
                .expiresAt(LocalDateTime.now().plusDays(expiryDays))
                .build();
        rc = registrationCodeRepository.save(rc);

        return ResponseEntity.status(HttpStatus.CREATED).body(InviteCodeResponse.from(rc));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        registrationCodeRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
