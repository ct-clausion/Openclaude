package com.classpulse.api;

import com.classpulse.config.SecurityUtil;
import com.classpulse.domain.announcement.*;
import com.classpulse.domain.audit.OperatorAuditLog;
import com.classpulse.domain.audit.AuditLogRepository;
import com.classpulse.domain.user.UserRepository;
import com.classpulse.notification.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/operator/announcements")
@RequiredArgsConstructor
@Transactional
public class AnnouncementController {

    private final AnnouncementRepository announcementRepository;
    private final AnnouncementReadRepository announcementReadRepository;
    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;
    private final AnnouncementAudienceService announcementAudienceService;
    private final NotificationService notificationService;

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAnnouncements() {
        List<Announcement> announcements = announcementRepository.findAllByOrderByCreatedAtDesc();
        List<Map<String, Object>> result = announcements.stream().map(a -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", a.getId());
            m.put("title", a.getTitle());
            m.put("content", a.getContent());
            m.put("targetType", a.getTargetType());
            m.put("targetCourseId", a.getTargetCourseId());
            m.put("isUrgent", a.getIsUrgent());
            m.put("authorId", a.getAuthorId());
            m.put("createdAt", a.getCreatedAt() != null ? a.getCreatedAt().toString() : null);
            m.put("readCount", announcementReadRepository.countByAnnouncementId(a.getId()));
            return m;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createAnnouncement(@RequestBody Map<String, Object> body) {
        Long authorId = SecurityUtil.getCurrentUserId();
        // Sanitize on write — any future switch to HTML rendering on the client becomes
        // XSS-safe by default instead of requiring all consumers to remember to escape.
        Announcement a = Announcement.builder()
                .title(com.classpulse.config.HtmlSanitizer.escape((String) body.get("title")))
                .content(com.classpulse.config.HtmlSanitizer.escape((String) body.get("content")))
                .targetType((String) body.getOrDefault("targetType", "ALL"))
                .targetCourseId(body.get("targetCourseId") != null ? Long.valueOf(body.get("targetCourseId").toString()) : null)
                .isUrgent(Boolean.TRUE.equals(body.get("isUrgent")))
                .authorId(authorId)
                .build();
        announcementRepository.save(a);
        notifyRecipients(a);

        try {
            OperatorAuditLog log = OperatorAuditLog.builder()
                    .operatorId(authorId)
                    .actionType("ANNOUNCEMENT_CREATE")
                    .targetType("ANNOUNCEMENT")
                    .targetId(a.getId())
                    .details(Map.of())
                    .build();
            auditLogRepository.save(log);
        } catch (Exception e) {
            log.error("Failed to write audit log", e);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", a.getId());
        result.put("title", a.getTitle());
        return ResponseEntity.ok(result);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Void> updateAnnouncement(@PathVariable Long id, @RequestBody Map<String, String> body) {
        Announcement a = announcementRepository.findById(id).orElse(null);
        if (a == null) return ResponseEntity.notFound().build();

        if (body.containsKey("title")) a.setTitle(com.classpulse.config.HtmlSanitizer.escape(body.get("title")));
        if (body.containsKey("content")) a.setContent(com.classpulse.config.HtmlSanitizer.escape(body.get("content")));
        announcementRepository.save(a);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('OPERATOR')")
    public ResponseEntity<Void> deleteAnnouncement(@PathVariable Long id) {
        // Delete read records first to avoid FK violation
        announcementReadRepository.deleteByAnnouncementId(id);
        announcementRepository.deleteById(id);

        try {
            OperatorAuditLog log = OperatorAuditLog.builder()
                    .operatorId(SecurityUtil.getCurrentUserId())
                    .actionType("ANNOUNCEMENT_DELETE")
                    .targetType("ANNOUNCEMENT")
                    .targetId(id)
                    .details(Map.of())
                    .build();
            auditLogRepository.save(log);
        } catch (Exception e) {
            log.error("Failed to write audit log", e);
        }

        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/stats")
    public ResponseEntity<Map<String, Object>> getAnnouncementStats(@PathVariable Long id) {
        Announcement announcement = announcementRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("공지사항을 찾을 수 없습니다: " + id));
        long readCount = announcementReadRepository.countByAnnouncementId(id);
        long totalUsers = announcementAudienceService.countRecipients(announcement);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalRecipients", totalUsers);
        result.put("readCount", readCount);
        result.put("readRate", totalUsers > 0 ? (double) readCount / totalUsers : 0.0);
        return ResponseEntity.ok(result);
    }

    private void notifyRecipients(Announcement announcement) {
        String notificationTitle = announcement.getIsUrgent()
                ? "긴급 공지: " + announcement.getTitle()
                : "새 공지: " + announcement.getTitle();
        String notificationMessage = summarizeContent(announcement.getContent());
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("announcementId", announcement.getId());
        data.put("targetType", announcement.getTargetType());
        data.put("targetCourseId", announcement.getTargetCourseId());
        data.put("isUrgent", announcement.getIsUrgent());

        for (Long recipientId : announcementAudienceService.resolveRecipientIds(announcement)) {
            notificationService.createNotification(
                    recipientId,
                    "ANNOUNCEMENT",
                    notificationTitle,
                    notificationMessage,
                    data
            );
        }
    }

    private String summarizeContent(String content) {
        if (content == null) {
            return "";
        }
        String normalized = content.trim().replaceAll("\\s+", " ");
        if (normalized.length() <= 120) {
            return normalized;
        }
        return normalized.substring(0, 117) + "...";
    }
}
