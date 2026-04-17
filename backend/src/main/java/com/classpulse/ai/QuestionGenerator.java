package com.classpulse.ai;

import com.classpulse.domain.course.Course;
import com.classpulse.domain.course.CourseRepository;
import com.classpulse.domain.course.CurriculumSkill;
import com.classpulse.domain.course.CurriculumSkillRepository;
import com.classpulse.domain.learning.Question;
import com.classpulse.domain.learning.QuestionRepository;
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
 * AI Engine 2 - 문제 생성기
 * 커리큘럼 스킬 기반으로 다양한 유형의 문제를 생성합니다.
 * 유형: 개념 이해, 코드 완성, 디버깅, 서술형, 시나리오 기반
 */
@Slf4j
@Service
public class QuestionGenerator {

    private static final String DEFAULT_QUESTION_TYPE = "DESCRIPTIVE";
    private static final String DEFAULT_DIFFICULTY = "MEDIUM";

    private final RestTemplate openAiRestTemplate;
    private final CourseRepository courseRepository;
    private final CurriculumSkillRepository curriculumSkillRepository;
    private final QuestionRepository questionRepository;
    private final ObjectMapper objectMapper;

    public QuestionGenerator(
            @Qualifier("openAiRestTemplate") RestTemplate openAiRestTemplate,
            CourseRepository courseRepository,
            CurriculumSkillRepository curriculumSkillRepository,
            QuestionRepository questionRepository,
            ObjectMapper objectMapper) {
        this.openAiRestTemplate = openAiRestTemplate;
        this.courseRepository = courseRepository;
        this.curriculumSkillRepository = curriculumSkillRepository;
        this.questionRepository = questionRepository;
        this.objectMapper = objectMapper;
    }

    private static final String SYSTEM_PROMPT = """
        당신은 프로그래밍 교육 전문 문제 출제 AI입니다.
        주어진 스킬 목록과 난이도에 맞는 고품질 문제를 생성합니다.

        반드시 다음 JSON 형식으로 응답하세요:
        {
          "questions": [
            {
              "skill_name": "해당 스킬 이름",
              "question_type": "CONCEPTUAL | CODE_COMPLETION | DEBUGGING | DESCRIPTIVE | SCENARIO",
              "difficulty": "EASY | MEDIUM | HARD",
              "content": "문제 본문 (마크다운 사용 가능, 코드 블록 포함 가능)",
              "answer": "모범 답안",
              "explanation": "해설 - 왜 이 답이 맞는지, 관련 개념 설명",
              "generation_reason": "이 문제를 생성한 교육적 의도"
            }
          ]
        }

        문제 유형별 가이드라인:
        - CONCEPTUAL: 개념 이해도를 확인하는 객관식/단답형 문제
        - CODE_COMPLETION: 빈칸 채우기 또는 함수 완성 문제
        - DEBUGGING: 버그가 있는 코드를 찾고 수정하는 문제
        - DESCRIPTIVE: 개념을 자신의 언어로 설명하게 하는 서술형 문제
        - SCENARIO: 실제 상황을 제시하고 해결 방안을 묻는 문제

        문제 출제 원칙:
        1. 각 문제는 하나의 핵심 스킬에 집중해야 합니다.
        2. 난이도가 EASY이면 기본 개념, MEDIUM이면 응용, HARD이면 복합 사고를 요구합니다.
        3. 해설은 학습자가 스스로 이해할 수 있도록 친절하게 작성합니다.
        4. 코드 예시는 실무에서 볼 수 있는 현실적인 패턴을 사용합니다.
        5. 문제 유형을 골고루 섞어서 출제합니다.
        """;

    private static final String PRACTICE_SYSTEM_PROMPT = """
        당신은 학생의 복습 미션을 바로 문제 풀이로 전환해주는 AI 튜터입니다.
        학생이 지금 바로 풀 수 있는 1개의 핵심 문제만 JSON으로 반환하세요.

        반드시 다음 JSON 형식으로 응답하세요:
        {
          "question_type": "CONCEPTUAL | CODE_COMPLETION | DEBUGGING | DESCRIPTIVE | SCENARIO",
          "difficulty": "EASY | MEDIUM | HARD",
          "content": "학생이 바로 풀 수 있는 문제 본문",
          "answer": "모범 답안",
          "explanation": "정답 해설과 사고 과정",
          "generation_reason": "왜 이 문제가 지금 필요한지"
        }

        작성 규칙:
        1. 학생이 10~15분 안에 풀 수 있는 1문제만 만듭니다.
        2. 코드 관련 스킬이면 입력/출력 또는 코드 스니펫을 포함해도 됩니다.
        3. 바로 채점 가능한 구체적인 답안을 제공합니다.
        4. 복습 이유와 연결된 문항이어야 합니다.
        """;

    private static final String PRACTICE_EVALUATION_SYSTEM_PROMPT = """
        당신은 프로그래밍 교육용 채점 코치입니다.
        학생 답안을 모범 답안과 비교해 공정하고 구체적인 피드백을 제공합니다.

        반드시 다음 JSON 형식으로만 응답하세요:
        {
          "score": 0,
          "passed": true,
          "verdict": "한 줄 총평",
          "strengths": ["잘한 점 1", "잘한 점 2"],
          "improvements": ["보완점 1", "보완점 2"],
          "model_answer": "학생이 다시 확인할 모범 답안",
          "coaching_tip": "바로 다음에 할 한 가지 행동"
        }

        채점 기준:
        1. 핵심 개념 정확성
        2. 답의 완결성
        3. 코드 또는 예시의 적절성
        4. 오개념 여부
        """;

    @Transactional
    public Map<String, Object> generate(Long courseId, String difficulty, int count) {
        return generate(courseId, null, difficulty, count);
    }

    @Transactional
    public Map<String, Object> generate(Long courseId, Long skillId, String difficulty, int count) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new IllegalArgumentException("Course not found: " + courseId));

        List<CurriculumSkill> skills = curriculumSkillRepository.findByCourseId(courseId);
        if (skillId != null) {
            skills = skills.stream()
                    .filter(skill -> skill.getId().equals(skillId))
                    .toList();
            if (skills.isEmpty()) {
                throw new IllegalArgumentException("해당 스킬을 찾을 수 없습니다: " + skillId);
            }
        }
        if (skills.isEmpty()) {
            throw new IllegalStateException("해당 과목에 등록된 스킬이 없습니다. 커리큘럼 분석을 먼저 실행하세요.");
        }

        String skillList = skills.stream()
                .map(s -> String.format("- %s (%s): %s",
                        s.getName(), s.getDifficulty(),
                        s.getDescription() != null ? s.getDescription() : ""))
                .collect(Collectors.joining("\n"));

        // Build skill name -> entity map for linking
        Map<String, CurriculumSkill> skillMap = skills.stream()
                .collect(Collectors.toMap(CurriculumSkill::getName, s -> s, (a, b) -> a));

        String skillInstruction = skills.size() == 1
                ? String.format("'%s' 스킬에 집중하여 %d개의 문제를 생성하세요. 이 스킬의 다양한 측면을 다루되, 5가지 문제 유형을 골고루 배분하세요.", skills.get(0).getName(), count)
                : String.format("위 스킬들을 기반으로 %d개의 문제를 생성하세요. 난이도 '%s'에 맞춰 출제하되, 5가지 문제 유형을 골고루 배분하세요.", count, difficulty);

        String userPrompt = String.format("""
                ## 강의 정보
                - 강의명: %s
                - 요청 난이도: %s
                - 요청 문제 수: %d

                ## 대상 스킬 목록
                %s

                %s
                """,
                course.getTitle(),
                difficulty,
                count,
                skillList,
                skillInstruction
        );

        Map<String, Object> gptResponse = callGpt4o(SYSTEM_PROMPT, userPrompt);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> questionMaps =
                (List<Map<String, Object>>) gptResponse.getOrDefault("questions", List.of());

        List<Question> savedQuestions = new ArrayList<>();
        for (Map<String, Object> qMap : questionMaps) {
            String skillName = (String) qMap.get("skill_name");
            CurriculumSkill linkedSkill = skillMap.get(skillName);

            Question question = Question.builder()
                    .course(course)
                    .skill(linkedSkill)
                    .questionType((String) qMap.get("question_type"))
                    .difficulty((String) qMap.getOrDefault("difficulty", difficulty))
                    .content((String) qMap.get("content"))
                    .answer((String) qMap.get("answer"))
                    .explanation((String) qMap.get("explanation"))
                    .generationReason((String) qMap.get("generation_reason"))
                    .approvalStatus("PENDING")
                    .build();
            savedQuestions.add(questionRepository.save(question));
        }

        log.info("문제 생성 완료 - courseId={}, 생성 수={}", courseId, savedQuestions.size());

        return Map.of(
                "courseId", courseId,
                "generatedCount", savedQuestions.size(),
                "questionIds", savedQuestions.stream().map(Question::getId).collect(Collectors.toList()),
                "questions", questionMaps
        );
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getPracticeQuestion(
            Long courseId,
            Long skillId,
            String taskTitle,
            String reasonSummary
    ) {
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new IllegalArgumentException("Course not found: " + courseId));
        CurriculumSkill skill = skillId != null
                ? curriculumSkillRepository.findById(skillId).orElse(null)
                : null;

        List<Question> approvedQuestions = skillId != null
                ? questionRepository.findByCourseIdAndSkillIdAndApprovalStatus(courseId, skillId, "APPROVED")
                : List.of();

        if (approvedQuestions.isEmpty()) {
            approvedQuestions = questionRepository.findByCourseIdAndApprovalStatus(courseId, "APPROVED");
        }

        if (!approvedQuestions.isEmpty()) {
            Question selected = approvedQuestions.stream()
                    .sorted(Comparator.comparing(
                            Question::getCreatedAt,
                            Comparator.nullsLast(Comparator.reverseOrder())))
                    .findFirst()
                    .orElse(approvedQuestions.get(0));
            return toPracticeQuestion(selected, "BANK");
        }

        try {
            return generatePracticeQuestionWithAi(course, skill, taskTitle, reasonSummary);
        } catch (Exception e) {
            log.warn("연습문제 AI 생성 실패 - courseId={}, skillId={}", courseId, skillId, e);
            return fallbackPracticeQuestion(course, skill, taskTitle, reasonSummary);
        }
    }

    @Transactional(readOnly = true)
    public Map<String, Object> evaluatePracticeAnswer(
            Long courseId,
            Long skillId,
            String questionType,
            String questionContent,
            String referenceAnswer,
            String explanation,
            String studentAnswer
    ) {
        if (studentAnswer == null || studentAnswer.isBlank()) {
            throw new IllegalArgumentException("학생 답안을 입력해주세요.");
        }
        // Cap answer length before it hits the prompt — stops token-bomb and injection.
        studentAnswer = AiInputGuard.truncate(studentAnswer, AiInputGuard.MAX_STUDENT_ANSWER_CHARS);

        Course course = courseId != null
                ? courseRepository.findById(courseId).orElse(null)
                : null;
        CurriculumSkill skill = skillId != null
                ? curriculumSkillRepository.findById(skillId).orElse(null)
                : null;

        try {
            String userPrompt = String.format("""
                    ## 강의/스킬 맥락
                    - 강의명: %s
                    - 스킬명: %s
                    - 문제 유형: %s

                    ## 문제
                    %s

                    ## 모범 답안
                    %s

                    ## 해설
                    %s

                    ## 학생 답안
                    %s

                    위 학생 답안을 채점하고, 학생이 바로 수정할 수 있도록 피드백을 작성하세요.
                    """,
                    course != null ? course.getTitle() : "미지정",
                    skill != null ? skill.getName() : "미지정",
                    questionType != null ? questionType : DEFAULT_QUESTION_TYPE,
                    questionContent != null ? questionContent : "",
                    referenceAnswer != null ? referenceAnswer : "",
                    explanation != null ? explanation : "",
                    studentAnswer
            );

            return normalizeEvaluationPayload(
                    callGpt4o(PRACTICE_EVALUATION_SYSTEM_PROMPT, userPrompt),
                    referenceAnswer,
                    explanation
            );
        } catch (Exception e) {
            log.warn("학생 답안 AI 평가 실패 - courseId={}, skillId={}", courseId, skillId, e);
            return fallbackEvaluation(referenceAnswer, explanation, studentAnswer);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> callGpt4o(String systemPrompt, String userPrompt) {
        var messages = List.of(
                Map.of("role", "system", "content", systemPrompt),
                Map.of("role", "user", "content", userPrompt)
        );
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
            throw new RuntimeException("GPT 응답 JSON 파싱 실패", e);
        }
    }

    @SuppressWarnings("unchecked")
    private String extractContent(Map<String, Object> response) {
        List<Map<String, Object>> choices = (List<Map<String, Object>>) response.get("choices");
        Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
        return (String) message.get("content");
    }

    private Map<String, Object> generatePracticeQuestionWithAi(
            Course course,
            CurriculumSkill skill,
            String taskTitle,
            String reasonSummary
    ) {
        String userPrompt = String.format("""
                ## 강의 정보
                - 강의명: %s
                - 대상 스킬: %s
                - 스킬 설명: %s
                - 복습 미션 제목: %s
                - 복습 이유: %s

                학생이 지금 바로 풀 수 있는 1개의 핵심 문제를 만들어 주세요.
                """,
                course.getTitle(),
                skill != null ? skill.getName() : "강의 핵심 개념",
                skill != null && skill.getDescription() != null ? skill.getDescription() : "복습이 필요한 핵심 개념",
                taskTitle != null ? taskTitle : "AI 추천 복습",
                reasonSummary != null ? reasonSummary : "학습 정착을 위한 즉시 복습"
        );

        Map<String, Object> payload = callGpt4o(PRACTICE_SYSTEM_PROMPT, userPrompt);
        return normalizePracticeQuestionPayload(
                payload,
                course.getId(),
                skill != null ? skill.getId() : null,
                "AI"
        );
    }

    private Map<String, Object> toPracticeQuestion(Question question, String source) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", String.valueOf(question.getId()));
        result.put("courseId", question.getCourse().getId());
        result.put("skillId", question.getSkill() != null ? question.getSkill().getId() : null);
        result.put("questionType", valueOrDefault(question.getQuestionType(), DEFAULT_QUESTION_TYPE));
        result.put("difficulty", valueOrDefault(question.getDifficulty(), DEFAULT_DIFFICULTY));
        result.put("content", valueOrDefault(question.getContent(), "문제 내용이 비어 있습니다."));
        result.put("answer", valueOrDefault(question.getAnswer(), ""));
        result.put("explanation", valueOrDefault(question.getExplanation(), ""));
        result.put("generationReason", valueOrDefault(question.getGenerationReason(), "승인된 문제은행에서 불러온 문제입니다."));
        result.put("approvalStatus", valueOrDefault(question.getApprovalStatus(), "APPROVED"));
        result.put("source", source);
        return result;
    }

    private Map<String, Object> normalizePracticeQuestionPayload(
            Map<String, Object> payload,
            Long courseId,
            Long skillId,
            String source
    ) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", "ai-" + UUID.randomUUID());
        result.put("courseId", courseId);
        result.put("skillId", skillId);
        result.put("questionType", valueOrDefault(asString(payload.get("question_type")), DEFAULT_QUESTION_TYPE));
        result.put("difficulty", valueOrDefault(asString(payload.get("difficulty")), DEFAULT_DIFFICULTY));
        result.put("content", valueOrDefault(asString(payload.get("content")), "문제를 생성하지 못했습니다."));
        result.put("answer", valueOrDefault(asString(payload.get("answer")), ""));
        result.put("explanation", valueOrDefault(asString(payload.get("explanation")), ""));
        result.put("generationReason", valueOrDefault(asString(payload.get("generation_reason")), "AI가 복습 미션에 맞춰 생성한 문제입니다."));
        result.put("approvalStatus", "AI_GENERATED");
        result.put("source", source);
        return result;
    }

    private Map<String, Object> fallbackPracticeQuestion(
            Course course,
            CurriculumSkill skill,
            String taskTitle,
            String reasonSummary
    ) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", "fallback-" + UUID.randomUUID());
        result.put("courseId", course.getId());
        result.put("skillId", skill != null ? skill.getId() : null);
        result.put("questionType", DEFAULT_QUESTION_TYPE);
        result.put("difficulty", skill != null ? valueOrDefault(skill.getDifficulty(), DEFAULT_DIFFICULTY) : DEFAULT_DIFFICULTY);
        result.put("content", """
                다음 항목을 순서대로 작성하세요.

                1. '%s'의 핵심 개념을 자신의 말로 설명하세요.
                2. 이 개념이 실제 코드에서 어떻게 쓰이는지 5~10줄 예시를 작성하세요.
                3. 초보자가 가장 자주 틀리는 포인트를 1개 적고 이유를 설명하세요.

                복습 맥락
                - 대상 스킬: %s
                - 오늘 미션: %s
                - 복습 이유: %s
                """.formatted(
                skill != null ? skill.getName() : course.getTitle(),
                skill != null ? skill.getName() : "핵심 개념",
                valueOrDefault(taskTitle, "핵심 개념 복습"),
                valueOrDefault(reasonSummary, "학습 내용을 다시 정리해 기억을 강화해야 합니다.")
        ));
        result.put("answer", """
                핵심 개념 정의, 실제 사용 예시, 흔한 실수와 그 이유가 모두 포함되어야 합니다.
                코드 예시는 변수명과 흐름이 명확해야 하며, 설명과 코드가 서로 연결되어야 합니다.
                """);
        result.put("explanation", """
                개념 정의만 적는 답안보다, 왜 쓰는지와 어떤 상황에서 유용한지까지 연결한 답안이 더 좋습니다.
                가능하면 짧은 코드 예시와 함께 설명하세요.
                """);
        result.put("generationReason", "문제은행과 AI 응답이 없어서 복습 미션을 바로 풀 수 있는 서술형 문제로 자동 구성했습니다.");
        result.put("approvalStatus", "AI_GENERATED");
        result.put("source", "FALLBACK");
        return result;
    }

    private Map<String, Object> normalizeEvaluationPayload(
            Map<String, Object> payload,
            String referenceAnswer,
            String explanation
    ) {
        int score = clampScore(asInt(payload.get("score"), 65));
        List<String> strengths = withDefaultList(toStringList(payload.get("strengths")), "핵심 방향은 맞게 접근했습니다.");
        List<String> improvements = withDefaultList(
                toStringList(payload.get("improvements")),
                "모범 답안과 비교해 빠진 핵심 개념을 보완해보세요."
        );

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("score", score);
        result.put("passed", payload.get("passed") instanceof Boolean b ? b : score >= 70);
        result.put("verdict", valueOrDefault(asString(payload.get("verdict")), score >= 70 ? "핵심은 이해했습니다." : "핵심 개념을 조금 더 정리할 필요가 있습니다."));
        result.put("strengths", strengths);
        result.put("improvements", improvements);
        result.put("modelAnswer", valueOrDefault(asString(payload.get("model_answer")), valueOrDefault(referenceAnswer, explanation)));
        result.put("coachingTip", valueOrDefault(asString(payload.get("coaching_tip")), "해설을 보고 같은 문제를 3줄로 다시 요약해보세요."));
        return result;
    }

    private Map<String, Object> fallbackEvaluation(
            String referenceAnswer,
            String explanation,
            String studentAnswer
    ) {
        Set<String> referenceTokens = tokenize(valueOrDefault(referenceAnswer, "") + " " + valueOrDefault(explanation, ""));
        Set<String> studentTokens = tokenize(studentAnswer);

        double coverage;
        if (referenceTokens.isEmpty()) {
            coverage = Math.min(studentAnswer.trim().length() / 180.0, 1.0);
        } else {
            long overlap = studentTokens.stream().filter(referenceTokens::contains).count();
            coverage = (double) overlap / referenceTokens.size();
        }

        int score = clampScore((int) Math.round(35 + coverage * 55));
        boolean passed = score >= 70;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("score", score);
        result.put("passed", passed);
        result.put("verdict", passed ? "핵심 포인트는 대체로 맞았습니다." : "핵심 키워드가 충분히 드러나지 않았습니다.");
        result.put("strengths", List.of(
                "자신의 언어로 설명하려는 시도가 보입니다.",
                "답안을 끝까지 작성해 복습 흐름을 유지했습니다."
        ));
        result.put("improvements", List.of(
                "모범 답안의 핵심 용어를 2~3개 다시 포함해보세요.",
                "설명만 하지 말고 짧은 코드나 예시를 함께 적어보세요."
        ));
        result.put("modelAnswer", valueOrDefault(referenceAnswer, explanation));
        result.put("coachingTip", "해설을 보고 답안을 5문장 이내로 다시 써보면 정착 속도가 빨라집니다.");
        return result;
    }

    private int clampScore(int score) {
        return Math.max(0, Math.min(100, score));
    }

    private int asInt(Object value, int fallback) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value instanceof String text) {
            try {
                return Integer.parseInt(text.trim());
            } catch (NumberFormatException ignored) {
                return fallback;
            }
        }
        return fallback;
    }

    private String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private String valueOrDefault(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private List<String> toStringList(Object value) {
        if (value == null) {
            return List.of();
        }
        if (value instanceof List<?> list) {
            return list.stream()
                    .map(String::valueOf)
                    .filter(item -> !item.isBlank())
                    .toList();
        }
        return List.of(String.valueOf(value));
    }

    private List<String> withDefaultList(List<String> items, String fallback) {
        return items == null || items.isEmpty() ? List.of(fallback) : items;
    }

    private Set<String> tokenize(String value) {
        if (value == null || value.isBlank()) {
            return Set.of();
        }
        return Arrays.stream(value
                        .toLowerCase(Locale.ROOT)
                        .replaceAll("[^\\p{L}\\p{N}\\s]", " ")
                        .split("\\s+"))
                .filter(token -> token.length() >= 2)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }
}
