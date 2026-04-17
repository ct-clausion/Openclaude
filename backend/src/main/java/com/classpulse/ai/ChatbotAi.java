package com.classpulse.ai;

import com.classpulse.domain.chatbot.ChatMessage;
import com.classpulse.domain.chatbot.ChatMessageRepository;
import com.classpulse.domain.chatbot.Conversation;
import com.classpulse.domain.chatbot.ConversationRepository;
import com.classpulse.domain.twin.StudentTwin;
import com.classpulse.domain.twin.StudentTwinRepository;
import com.classpulse.domain.twin.SkillMasterySnapshot;
import com.classpulse.domain.twin.SkillMasterySnapshotRepository;
import com.classpulse.domain.learning.Reflection;
import com.classpulse.domain.learning.ReflectionRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.stream.Collectors;

/**
 * AI Engine 6 [v2] - 학습 챗봇 AI
 * 트윈 컨텍스트(약점 스킬, 자신감, 최근 성찰)를 시스템 프롬프트에 포함하고,
 * 대화 기록을 유지하며, 텍스트 응답 + 인라인 카드를 반환합니다.
 */
@Slf4j
@Service
public class ChatbotAi {

    private final RestTemplate openAiRestTemplate;
    private final ConversationRepository conversationRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final StudentTwinRepository studentTwinRepository;
    private final SkillMasterySnapshotRepository snapshotRepository;
    private final ReflectionRepository reflectionRepository;
    private final ObjectMapper objectMapper;

    public ChatbotAi(
            @Qualifier("openAiRestTemplate") RestTemplate openAiRestTemplate,
            ConversationRepository conversationRepository,
            ChatMessageRepository chatMessageRepository,
            StudentTwinRepository studentTwinRepository,
            SkillMasterySnapshotRepository snapshotRepository,
            ReflectionRepository reflectionRepository,
            ObjectMapper objectMapper) {
        this.openAiRestTemplate = openAiRestTemplate;
        this.conversationRepository = conversationRepository;
        this.chatMessageRepository = chatMessageRepository;
        this.studentTwinRepository = studentTwinRepository;
        this.snapshotRepository = snapshotRepository;
        this.reflectionRepository = reflectionRepository;
        this.objectMapper = objectMapper;
    }

    private static final String BASE_SYSTEM_PROMPT = """
        당신은 ClassPulse 학습 도우미 AI '펄스(Pulse)'입니다.
        대학생의 프로그래밍 학습을 도와주는 친근하고 전문적인 AI 튜터입니다.

        ## 대화 원칙
        1. 학생의 현재 수준에 맞춰 설명합니다.
        2. 직접 답을 알려주기보다 사고 과정을 유도합니다 (소크라테스 방식).
        3. 격려와 긍정적 피드백을 자주 합니다.
        4. 코드 예시는 간결하고 이해하기 쉽게 작성합니다.
        5. 약점 스킬에 대한 질문이 오면 특히 세심하게 단계적으로 설명합니다.

        ## 응답 형식
        반드시 다음 JSON 형식으로 응답하세요:
        {
          "text": "일반 텍스트 응답 (마크다운 사용 가능)",
          "inline_cards": [
            {
              "type": "review_steps | resource_link | action_confirm",
              "title": "카드 제목",
              "content": "카드 내용",
              "action_url": "관련 URL (선택)",
              "metadata": {}
            }
          ]
        }

        ## 인라인 카드 사용 가이드
        - review_steps: 복습 단계를 안내할 때 (개념 정리 → 예제 풀이 → 응용)
        - resource_link: 추가 학습 자료를 추천할 때
        - action_confirm: 학습 계획 수립이나 목표 설정 확인 시

        카드가 필요 없는 일반 대화에서는 inline_cards를 빈 배열로 반환하세요.
        """;

    /**
     * 대화 메시지를 처리하고 AI 응답을 생성합니다.
     *
     * No @Transactional here: the LLM call is slow (seconds-to-minutes) and must not
     * hold a DB connection. Each repository.save() below runs in its own implicit
     * transaction, so a GPT failure leaves the user's message committed — conversation
     * history stays consistent for the retry.
     */
    public Map<String, Object> chat(Long conversationId, String userMessage) {
        // Double safety: controller already truncates, but we guard here too in case
        // another code path (worker, retry, test) invokes the service directly.
        userMessage = AiInputGuard.truncate(userMessage, AiInputGuard.MAX_CHAT_MESSAGE_CHARS);

        Conversation conversation = conversationRepository.findByIdWithRelations(conversationId)
                .orElseThrow(() -> new IllegalArgumentException("Conversation not found: " + conversationId));

        Long studentId = conversation.getStudent().getId();
        Long courseId = conversation.getCourse() != null ? conversation.getCourse().getId() : null;

        // Save user message
        ChatMessage userMsg = ChatMessage.builder()
                .conversation(conversation)
                .role("USER")
                .content(userMessage)
                .build();
        chatMessageRepository.save(userMsg);

        // Build twin context for system prompt
        String twinContext = buildTwinContext(studentId, courseId);

        // Build system prompt with twin context
        String systemPrompt = BASE_SYSTEM_PROMPT + "\n\n## 현재 학생 컨텍스트\n" + twinContext;

        // Build conversation history (last 10 messages)
        List<ChatMessage> recentMessages = chatMessageRepository
                .findTop10ByConversationIdOrderByCreatedAtDesc(conversationId);
        Collections.reverse(recentMessages); // chronological order

        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", systemPrompt));

        for (ChatMessage msg : recentMessages) {
            String role = "USER".equals(msg.getRole()) ? "user" : "assistant";
            // For assistant messages, just use the text content
            String content = msg.getContent();
            messages.add(Map.of("role", role, "content", content));
        }

        // Add current user message (already in the recent messages if just saved,
        // but we need to make sure it's at the end)
        if (recentMessages.isEmpty()
                || !recentMessages.get(recentMessages.size() - 1).getId().equals(userMsg.getId())) {
            messages.add(Map.of("role", "user", "content", userMessage));
        }

        // Call GPT-4o
        Map<String, Object> gptResponse = callGpt4o(messages);

        String responseText = (String) gptResponse.getOrDefault("text", "");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> inlineCards =
                (List<Map<String, Object>>) gptResponse.getOrDefault("inline_cards", List.of());

        // Save assistant message
        ChatMessage assistantMsg = ChatMessage.builder()
                .conversation(conversation)
                .role("ASSISTANT")
                .content(responseText)
                .inlineCardsJson(inlineCards)
                .build();
        chatMessageRepository.save(assistantMsg);

        // Update conversation twin context
        if (courseId != null) {
            Map<String, Object> twinCtxJson = new HashMap<>();
            twinCtxJson.put("lastUpdated", System.currentTimeMillis());
            twinCtxJson.put("context", twinContext);
            conversation.setTwinContextJson(twinCtxJson);
        }
        conversationRepository.save(conversation);

        return Map.of(
                "conversationId", conversationId,
                "messageId", assistantMsg.getId(),
                "text", responseText,
                "inlineCards", inlineCards
        );
    }

    /**
     * 새 대화를 시작합니다.
     */
    @Transactional
    public Conversation startConversation(Long studentId, Long courseId, String title) {
        com.classpulse.domain.user.User student = new com.classpulse.domain.user.User();
        student.setId(studentId);

        Conversation.ConversationBuilder builder = Conversation.builder()
                .student(student)
                .title(title != null ? title : "새 대화")
                .status("ACTIVE");

        if (courseId != null) {
            com.classpulse.domain.course.Course course = new com.classpulse.domain.course.Course();
            course.setId(courseId);
            builder.course(course);
        }

        return conversationRepository.save(builder.build());
    }

    private String buildTwinContext(Long studentId, Long courseId) {
        StringBuilder ctx = new StringBuilder();

        if (courseId != null) {
            StudentTwin twin = studentTwinRepository.findByStudentIdAndCourseId(studentId, courseId)
                    .orElse(null);

            if (twin != null) {
                ctx.append(String.format("""
                        - 이해도: %.1f/100, 실행력: %.1f/100, 동기: %.1f/100
                        - 망각위험: %.1f/100, 종합위험: %.1f/100
                        """,
                        twin.getMasteryScore(), twin.getExecutionScore(), twin.getMotivationScore(),
                        twin.getRetentionRiskScore(), twin.getOverallRiskScore()));

                if (twin.getAiInsight() != null) {
                    ctx.append("- 인사이트: ").append(twin.getAiInsight()).append("\n");
                }
            }

            // Weak skills
            List<SkillMasterySnapshot> snapshots = snapshotRepository
                    .findByStudentIdAndCourseIdOrderByCapturedAtDesc(studentId, courseId);
            Map<String, SkillMasterySnapshot> latestPerSkill = new LinkedHashMap<>();
            for (SkillMasterySnapshot s : snapshots) {
                latestPerSkill.putIfAbsent(s.getSkill().getName(), s);
            }

            List<String> weakSkills = latestPerSkill.entrySet().stream()
                    .filter(e -> e.getValue().getUnderstandingScore().doubleValue() < 50
                            || e.getValue().getForgettingRiskScore().doubleValue() > 60)
                    .map(Map.Entry::getKey)
                    .collect(Collectors.toList());

            if (!weakSkills.isEmpty()) {
                ctx.append("- 약점 스킬: ").append(String.join(", ", weakSkills)).append("\n");
            }
        }

        // Recent reflections
        List<Reflection> reflections = reflectionRepository.findTop5ByStudentIdOrderByCreatedAtDesc(studentId);
        if (!reflections.isEmpty()) {
            Reflection latest = reflections.get(0);
            ctx.append(String.format("- 최근 자신감: %d/5\n", latest.getSelfConfidenceScore()));
            if (latest.getStuckPoint() != null) {
                ctx.append("- 최근 막힌점: ").append(latest.getStuckPoint()).append("\n");
            }
        }

        return ctx.length() > 0 ? ctx.toString() : "학생 데이터가 아직 충분하지 않습니다.";
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> callGpt4o(List<Map<String, String>> messages) {
        var body = Map.of(
                "model", "gpt-4o",
                "messages", messages,
                "response_format", Map.of("type", "json_object"),
                "temperature", 0.8
        );
        Map<String, Object> response = openAiRestTemplate.postForObject(
                "/chat/completions", body, Map.class);

        String content = extractContent(response);
        try {
            return objectMapper.readValue(content, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            log.error("GPT 응답 파싱 실패: {}", content, e);
            // Fallback: return plain text response
            return Map.of("text", content, "inline_cards", List.of());
        }
    }

    @SuppressWarnings("unchecked")
    private String extractContent(Map<String, Object> response) {
        List<Map<String, Object>> choices = (List<Map<String, Object>>) response.get("choices");
        Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
        return (String) message.get("content");
    }
}
