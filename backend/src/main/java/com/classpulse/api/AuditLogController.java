package com.classpulse.api;

import com.classpulse.domain.audit.AuditLogRepository;
import com.classpulse.domain.audit.OperatorAuditLog;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@org.springframework.security.access.prepost.PreAuthorize("hasRole('OPERATOR')")
@RequestMapping("/api/operator/audit-logs")
@RequiredArgsConstructor
public class AuditLogController {

    private final AuditLogRepository auditLogRepository;

    @GetMapping
    public ResponseEntity<Map<String, Object>> getAuditLogs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String actionType,
            @RequestParam(required = false) String targetType) {
        PageRequest pageable = PageRequest.of(page, size);
        boolean hasAction = actionType != null && !actionType.isBlank();
        boolean hasTarget = targetType != null && !targetType.isBlank();

        Page<OperatorAuditLog> logPage;
        if (hasAction && hasTarget) {
            logPage = auditLogRepository.findByActionTypeAndTargetTypeOrderByCreatedAtDesc(actionType, targetType, pageable);
        } else if (hasAction) {
            logPage = auditLogRepository.findByActionTypeOrderByCreatedAtDesc(actionType, pageable);
        } else if (hasTarget) {
            logPage = auditLogRepository.findByTargetTypeOrderByCreatedAtDesc(targetType, pageable);
        } else {
            logPage = auditLogRepository.findAllByOrderByCreatedAtDesc(pageable);
        }

        List<Map<String, Object>> content = logPage.getContent().stream().map(log -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", log.getId());
            m.put("operatorId", log.getOperatorId());
            m.put("actionType", log.getActionType());
            m.put("targetType", log.getTargetType());
            m.put("targetId", log.getTargetId());
            m.put("details", log.getDetails());
            m.put("createdAt", log.getCreatedAt() != null ? log.getCreatedAt().toString() : null);
            return m;
        }).collect(Collectors.toList());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("content", content);
        result.put("totalPages", logPage.getTotalPages());
        result.put("totalElements", logPage.getTotalElements());
        return ResponseEntity.ok(result);
    }
}
