package com.classpulse.domain.studygroup;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StudyGroupMessageRepository extends JpaRepository<StudyGroupMessage, Long> {

    @EntityGraph(attributePaths = {"sender"})
    List<StudyGroupMessage> findByStudyGroupIdOrderByCreatedAtDesc(Long studyGroupId, Pageable pageable);

    void deleteByStudyGroupId(Long studyGroupId);

    List<StudyGroupMessage> findByFileKey(String fileKey);

    @org.springframework.data.jpa.repository.Query(
            "SELECT m.fileKey FROM StudyGroupMessage m " +
            "WHERE m.studyGroup.id = :groupId AND m.fileKey IS NOT NULL")
    List<String> findFileKeysByStudyGroupId(@org.springframework.data.repository.query.Param("groupId") Long groupId);
}
