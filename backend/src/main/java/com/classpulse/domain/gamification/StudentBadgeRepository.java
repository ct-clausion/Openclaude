package com.classpulse.domain.gamification;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface StudentBadgeRepository extends JpaRepository<StudentBadge, Long> {
    // Eager-fetch the Badge because OSIV is disabled and the controller serializes
    // badge fields outside any transaction — plain findByStudentId hits LazyInit.
    @Query("SELECT sb FROM StudentBadge sb JOIN FETCH sb.badge WHERE sb.student.id = :studentId")
    List<StudentBadge> findByStudentId(@Param("studentId") Long studentId);

    boolean existsByStudentIdAndBadgeId(Long studentId, Long badgeId);
}
