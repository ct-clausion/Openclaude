package com.classpulse.domain.invite;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RegistrationCodeRepository extends JpaRepository<RegistrationCode, Long> {
    Optional<RegistrationCode> findByCode(String code);
    List<RegistrationCode> findByCreatedByIdOrderByCreatedAtDesc(Long createdById);
    List<RegistrationCode> findAllByOrderByCreatedAtDesc();
}
