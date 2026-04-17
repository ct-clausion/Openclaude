package com.classpulse.domain.chatbot;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ConversationRepository extends JpaRepository<Conversation, Long> {
    List<Conversation> findByStudentIdAndStatusOrderByUpdatedAtDesc(Long studentId, String status);
    List<Conversation> findByStudentIdOrderByUpdatedAtDesc(Long studentId);
    List<Conversation> findByStudentIdAndCourseIdOrderByUpdatedAtDesc(Long studentId, Long courseId);

    /**
     * Eager-load student + course so the chatbot flow can run outside a transaction
     * without hitting LazyInitializationException (OSIV is disabled).
     */
    @Query("SELECT c FROM Conversation c LEFT JOIN FETCH c.student LEFT JOIN FETCH c.course WHERE c.id = :id")
    Optional<Conversation> findByIdWithRelations(@Param("id") Long id);
}
