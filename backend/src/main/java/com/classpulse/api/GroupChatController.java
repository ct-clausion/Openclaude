package com.classpulse.api;

import com.classpulse.config.RabbitMQConfig;
import com.classpulse.config.SecurityUtil;
import com.classpulse.domain.studygroup.*;
import com.classpulse.domain.user.User;
import com.classpulse.domain.user.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Controller
@RequiredArgsConstructor
public class GroupChatController {

    private final StudyGroupMessageRepository messageRepository;
    private final StudyGroupRepository studyGroupRepository;
    private final UserService userService;
    private final SimpMessagingTemplate messagingTemplate;

    @Autowired(required = false)
    private RabbitTemplate rabbitTemplate;

    // ── DTOs ──────────────────────────────────────────────────────────

    public record ChatMessageRequest(
            String content,
            String fileKey,
            String fileName,
            Long fileSize,
            String contentType
    ) {}

    public record ChatMessageResponse(
            Long id, Long groupId, Long senderId, String senderName,
            String content, String messageType, String createdAt,
            String fileKey, String fileName, Long fileSize, String contentType
    ) {
        public static ChatMessageResponse from(StudyGroupMessage msg) {
            return new ChatMessageResponse(
                    msg.getId(),
                    msg.getStudyGroup().getId(),
                    msg.getSender().getId(),
                    msg.getSender().getName(),
                    msg.getContent(),
                    msg.getMessageType(),
                    msg.getCreatedAt().toString(),
                    msg.getFileKey(),
                    msg.getFileName(),
                    msg.getFileSize(),
                    msg.getContentType()
            );
        }
    }

    // ── STOMP Message Handler ─────────────────────────────────────────

    @MessageMapping("/group-chat/{groupId}/send")
    public void sendMessage(
            @DestinationVariable Long groupId,
            @Payload ChatMessageRequest request,
            Principal principal
    ) {
        if (principal == null) {
            log.warn("Unauthenticated STOMP message attempt to group {}", groupId);
            return;
        }

        Long userId = Long.parseLong(principal.getName());
        User sender = userService.findById(userId);

        StudyGroup group = studyGroupRepository.findById(groupId)
                .orElseThrow(() -> new IllegalArgumentException("Group not found: " + groupId));

        // Verify sender is a member
        boolean isMember = group.getMembers().stream()
                .anyMatch(m -> m.getStudent().getId().equals(userId));
        if (!isMember) {
            log.warn("User {} is not a member of group {}", userId, groupId);
            return;
        }

        String content = request.content() != null ? request.content().trim() : "";
        boolean isFile = request.fileKey() != null && !request.fileKey().isBlank();
        if (!isFile && content.isBlank()) {
            log.debug("Ignored blank group chat message - groupId={}, senderId={}", groupId, userId);
            return;
        }

        String resolvedContent = isFile
                ? (content.isBlank() ? Optional.ofNullable(request.fileName()).orElse("") : content)
                : content;
        // Server-side HTML escape — if any UI later renders chat as HTML, it's already safe.
        String safeContent = com.classpulse.config.HtmlSanitizer.escape(resolvedContent);

        StudyGroupMessage message = StudyGroupMessage.builder()
                .studyGroup(group)
                .sender(sender)
                .content(safeContent)
                .messageType(isFile ? "FILE" : "TEXT")
                .fileKey(isFile ? request.fileKey() : null)
                .fileName(isFile ? request.fileName() : null)
                .fileSize(isFile ? request.fileSize() : null)
                .contentType(isFile ? request.contentType() : null)
                .build();
        message = messageRepository.save(message);

        ChatMessageResponse response = ChatMessageResponse.from(message);

        // Publish via RabbitMQ or fall back to direct STOMP
        if (rabbitTemplate != null) {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("groupId", groupId);
            payload.put("id", response.id());
            payload.put("senderId", response.senderId());
            payload.put("senderName", response.senderName());
            payload.put("content", response.content());
            payload.put("messageType", response.messageType());
            payload.put("createdAt", response.createdAt());
            payload.put("fileKey", response.fileKey());
            payload.put("fileName", response.fileName());
            payload.put("fileSize", response.fileSize());
            payload.put("contentType", response.contentType());
            rabbitTemplate.convertAndSend(
                    RabbitMQConfig.GROUP_CHAT_EXCHANGE,
                    "group." + groupId,
                    payload
            );
            log.debug("Published group chat via RabbitMQ - groupId={}, senderId={}", groupId, userId);
        } else {
            messagingTemplate.convertAndSend("/topic/group-chat/" + groupId, response);
        }
    }

    // ── REST: Chat History ────────────────────────────────────────────

    @GetMapping("/api/group-chat/{groupId}/messages")
    @ResponseBody
    public ResponseEntity<List<ChatMessageResponse>> getMessages(
            @PathVariable Long groupId,
            @RequestParam(defaultValue = "50") int limit
    ) {
        Long userId = SecurityUtil.getCurrentUserId();

        StudyGroup group = studyGroupRepository.findById(groupId)
                .orElseThrow(() -> new IllegalArgumentException("Group not found: " + groupId));

        boolean isMember = group.getMembers().stream()
                .anyMatch(m -> m.getStudent().getId().equals(userId));
        if (!isMember) {
            return ResponseEntity.status(403).build();
        }

        List<StudyGroupMessage> messages = messageRepository
                .findByStudyGroupIdOrderByCreatedAtDesc(groupId, PageRequest.of(0, limit));

        // Reverse to chronological order
        List<ChatMessageResponse> response = new ArrayList<>(
                messages.stream().map(ChatMessageResponse::from).toList()
        );
        Collections.reverse(response);

        return ResponseEntity.ok(response);
    }
}
