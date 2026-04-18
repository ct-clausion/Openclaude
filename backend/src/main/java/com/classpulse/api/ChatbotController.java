package com.classpulse.api;

import com.classpulse.ai.ChatbotAi;
import com.classpulse.config.RateLimiter;
import com.classpulse.config.SecurityUtil;
import com.classpulse.domain.chatbot.ChatMessage;
import com.classpulse.domain.chatbot.ChatMessageRepository;
import com.classpulse.domain.chatbot.Conversation;
import com.classpulse.domain.chatbot.ConversationRepository;
import com.classpulse.domain.course.Course;
import com.classpulse.domain.course.CourseRepository;
import com.classpulse.domain.user.User;
import com.classpulse.domain.user.UserService;
import com.classpulse.notification.MessagePublisher;
import com.classpulse.notification.SseEmitterService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/chatbot/conversations")
@RequiredArgsConstructor
public class ChatbotController {

    private final ConversationRepository conversationRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final UserService userService;
    private final CourseRepository courseRepository;
    private final ChatbotAi chatbotAi;
    private final MessagePublisher messagePublisher;
    private final SseEmitterService sseEmitterService;
    private final RateLimiter rateLimiter;

    // --- DTOs ---

    public record CreateConversationRequest(Long courseId, String title) {}

    public record SendMessageRequest(String content) {}

    public record ConversationResponse(
            Long id, Long studentId, Long courseId,
            String title, String status,
            LocalDateTime createdAt, LocalDateTime updatedAt,
            int messageCount
    ) {
        public static ConversationResponse from(Conversation c, int messageCount) {
            return new ConversationResponse(
                    c.getId(), c.getStudent().getId(),
                    c.getCourse() != null ? c.getCourse().getId() : null,
                    c.getTitle(), c.getStatus(),
                    c.getCreatedAt(), c.getUpdatedAt(),
                    messageCount
            );
        }
    }

    public record MessageResponse(
            Long id, String role, String content,
            List<Map<String, Object>> inlineCards,
            Integer tokenCount, LocalDateTime createdAt
    ) {
        public static MessageResponse from(ChatMessage m) {
            return new MessageResponse(
                    m.getId(), m.getRole(), m.getContent(),
                    m.getInlineCardsJson(), m.getTokenCount(),
                    m.getCreatedAt()
            );
        }
    }

    public record ConversationDetailResponse(
            Long id, Long studentId, Long courseId,
            String title, String status,
            List<MessageResponse> messages,
            LocalDateTime createdAt, LocalDateTime updatedAt
    ) {
        public static ConversationDetailResponse from(Conversation c, List<ChatMessage> messages) {
            return new ConversationDetailResponse(
                    c.getId(), c.getStudent().getId(),
                    c.getCourse() != null ? c.getCourse().getId() : null,
                    c.getTitle(), c.getStatus(),
                    messages.stream().map(MessageResponse::from).toList(),
                    c.getCreatedAt(), c.getUpdatedAt()
            );
        }
    }

    // --- Endpoints ---

    @PostMapping
    public ResponseEntity<ConversationResponse> createConversation(@RequestBody CreateConversationRequest request) {
        Long userId = SecurityUtil.getCurrentUserId();
        User student = userService.findById(userId);

        Course course = null;
        if (request.courseId() != null) {
            course = courseRepository.findById(request.courseId()).orElse(null);
        }

        Conversation conversation = Conversation.builder()
                .student(student)
                .course(course)
                .title(request.title() != null ? request.title() : "New Conversation")
                .status("ACTIVE")
                .build();
        conversation = conversationRepository.save(conversation);

        return ResponseEntity.status(HttpStatus.CREATED).body(ConversationResponse.from(conversation, 0));
    }

    @GetMapping
    public ResponseEntity<List<ConversationResponse>> listConversations() {
        Long userId = SecurityUtil.getCurrentUserId();
        List<Conversation> conversations = conversationRepository.findByStudentIdOrderByUpdatedAtDesc(userId);
        // Pre-count messages in one query to avoid N+1 lazy-loads (OSIV is disabled).
        Map<Long, Integer> counts = new HashMap<>();
        for (Object[] row : conversationRepository.countMessagesByStudentId(userId)) {
            counts.put((Long) row[0], ((Number) row[1]).intValue());
        }
        return ResponseEntity.ok(
                conversations.stream()
                        .map(c -> ConversationResponse.from(c, counts.getOrDefault(c.getId(), 0)))
                        .toList()
        );
    }

    @GetMapping("/{id}")
    public ResponseEntity<ConversationDetailResponse> getConversation(@PathVariable Long id) {
        Conversation conversation = conversationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Conversation not found: " + id));

        // Verify ownership
        Long userId = SecurityUtil.getCurrentUserId();
        if (!conversation.getStudent().getId().equals(userId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        List<ChatMessage> messages = chatMessageRepository
                .findByConversationIdOrderByCreatedAtAsc(id);

        return ResponseEntity.ok(ConversationDetailResponse.from(conversation, messages));
    }

    @PostMapping("/{id}/messages")
    public ResponseEntity<?> sendMessage(
            @PathVariable Long id,
            @RequestBody SendMessageRequest request
    ) {
        Conversation conversation = conversationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Conversation not found: " + id));

        Long userId = SecurityUtil.getCurrentUserId();
        if (!conversation.getStudent().getId().equals(userId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        // Rate limit LLM-backed endpoints: 10 messages/min, 200/hour per user.
        // Protects the OpenAI bill against runaway scripts and infinite retries.
        String key = String.valueOf(userId);
        if (!rateLimiter.tryAcquire("chatbot-short", key, 60_000L, 10)
                || !rateLimiter.tryAcquire("chatbot-long", key, 3_600_000L, 200)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(Map.of("error", "메시지 전송 속도 제한에 도달했습니다. 잠시 후 다시 시도해주세요."));
        }

        // Bound user input length to cap prompt cost / LLM latency.
        String content = request.content();
        if (content != null && content.length() > 5000) {
            content = content.substring(0, 5000);
        }

        // Call ChatbotAi which saves user message, generates AI response with twin context,
        // saves assistant message, and updates conversation
        Map<String, Object> aiResult = chatbotAi.chat(id, content);

        Long messageId = (Long) aiResult.get("messageId");
        ChatMessage aiMessage = chatMessageRepository.findById(messageId)
                .orElseThrow(() -> new IllegalStateException("AI message not found: " + messageId));

        // Publish AI response to RabbitMQ
        messagePublisher.publishChatbotResponse(id, aiMessage);

        return ResponseEntity.status(HttpStatus.CREATED).body(MessageResponse.from(aiMessage));
    }

    /**
     * SSE stream endpoint for real-time chatbot messages in a conversation.
     */
    @GetMapping(value = "/{id}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamConversation(@PathVariable Long id) {
        Conversation conversation = conversationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Conversation not found: " + id));

        Long userId = SecurityUtil.getCurrentUserId();
        if (!conversation.getStudent().getId().equals(userId)) {
            throw new IllegalArgumentException("Forbidden");
        }

        return sseEmitterService.createChatbotEmitter(id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteConversation(@PathVariable Long id) {
        Conversation conversation = conversationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Conversation not found: " + id));

        Long userId = SecurityUtil.getCurrentUserId();
        if (!conversation.getStudent().getId().equals(userId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        conversation.setStatus("DELETED");
        conversationRepository.save(conversation);
        return ResponseEntity.noContent().build();
    }
}
