package com.classpulse.domain.invite;

import com.classpulse.domain.user.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "registration_codes")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class RegistrationCode {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String code;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id")
    private User createdBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "used_by_id")
    private User usedBy;

    @Column(name = "is_used", nullable = false)
    private Boolean isUsed;

    // Role this code authorizes — prevents a code meant for one role from being
    // redeemed as another (e.g., an INSTRUCTOR code used to create an OPERATOR).
    @Column(name = "target_role", nullable = false, length = 20)
    private String targetRole;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "used_at")
    private LocalDateTime usedAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (isUsed == null) isUsed = false;
    }

    public boolean isValid() {
        return !isUsed && expiresAt.isAfter(LocalDateTime.now());
    }
}
