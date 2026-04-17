package com.classpulse.ai;

import com.classpulse.domain.codeanalysis.CodeFeedback;
import com.classpulse.domain.codeanalysis.CodeFeedbackRepository;
import com.classpulse.domain.codeanalysis.CodeSubmission;
import com.classpulse.domain.codeanalysis.CodeSubmissionRepository;
import com.classpulse.domain.course.CurriculumSkill;
import com.classpulse.domain.course.CurriculumSkillRepository;
import com.classpulse.domain.twin.SkillMasterySnapshot;
import com.classpulse.domain.twin.SkillMasterySnapshotRepository;
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
 * AI Engine 7 [v2] - 코드 리뷰 AI
 * 코드 제출물을 분석하여 라인별 피드백을 생성합니다.
 * 학생의 트윈 약점 스킬과 연동하여 twinLinked 피드백을 제공합니다.
 */
@Slf4j
@Service
public class CodeReviewAi {

    private final RestTemplate openAiRestTemplate;
    private final CodeSubmissionRepository codeSubmissionRepository;
    private final CodeFeedbackRepository codeFeedbackRepository;
    private final CurriculumSkillRepository curriculumSkillRepository;
    private final SkillMasterySnapshotRepository snapshotRepository;
    private final ObjectMapper objectMapper;

    public CodeReviewAi(
            @Qualifier("openAiRestTemplate") RestTemplate openAiRestTemplate,
            CodeSubmissionRepository codeSubmissionRepository,
            CodeFeedbackRepository codeFeedbackRepository,
            CurriculumSkillRepository curriculumSkillRepository,
            SkillMasterySnapshotRepository snapshotRepository,
            ObjectMapper objectMapper) {
        this.openAiRestTemplate = openAiRestTemplate;
        this.codeSubmissionRepository = codeSubmissionRepository;
        this.codeFeedbackRepository = codeFeedbackRepository;
        this.curriculumSkillRepository = curriculumSkillRepository;
        this.snapshotRepository = snapshotRepository;
        this.objectMapper = objectMapper;
    }

    private static final String SYSTEM_PROMPT = """
        당신은 프로그래밍 교육 전문 코드 리뷰어 AI입니다.
        학생이 제출한 코드를 분석하여 교육적 피드백을 제공합니다.

        ## 학생의 약점 스킬 정보가 제공됩니다.
        약점과 관련된 코드 이슈를 발견하면 twin_linked를 true로 표시하고,
        해당 스킬과 연결하여 학생이 자신의 약점을 인식하도록 도와주세요.

        반드시 다음 JSON 형식으로 응답하세요:
        {
          "feedbacks": [
            {
              "line_number": 1,
              "end_line_number": 1,
              "severity": "ERROR | WARNING | INFO | GOOD",
              "message": "피드백 메시지 (한국어, 교육적 톤)",
              "suggestion": "개선 제안 코드 또는 설명",
              "twin_linked": false,
              "twin_skill_name": "관련 트윈 스킬 이름 (twin_linked가 true인 경우)"
            }
          ],
          "overall_summary": "코드 전체에 대한 종합 피드백 (2-3문장)",
          "score": 0-100,
          "strengths": ["잘한 점 1", "잘한 점 2"],
          "improvement_areas": ["개선점 1", "개선점 2"]
        }

        코드 리뷰 원칙:
        1. 에러/버그는 반드시 지적합니다.
        2. 좋은 코드 패턴에는 GOOD 피드백으로 격려합니다.
        3. 복잡한 개선 제안은 단계별로 설명합니다.
        4. 학생의 약점 스킬과 관련된 이슈는 더 자세히 설명합니다.
        5. 피드백은 비판이 아닌 학습 기회로 프레이밍합니다.
        """;

    @Transactional
    public Map<String, Object> review(Long submissionId) {
        CodeSubmission submission = codeSubmissionRepository.findById(submissionId)
                .orElseThrow(() -> new IllegalArgumentException("Submission not found: " + submissionId));

        Long studentId = submission.getStudent().getId();
        Long courseId = submission.getCourse().getId();
        String language = submission.getLanguage();
        // Hard cap: large submissions blow OpenAI token/$ budgets and create prompt-injection surface.
        String code = AiInputGuard.truncate(submission.getCodeContent(), AiInputGuard.MAX_CODE_CHARS);

        // Get student's weak skills
        List<CurriculumSkill> courseSkills = curriculumSkillRepository.findByCourseId(courseId);
        Map<String, CurriculumSkill> skillNameMap = courseSkills.stream()
                .collect(Collectors.toMap(CurriculumSkill::getName, s -> s, (a, b) -> a));

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

        String userPrompt = String.format("""
                ## 프로그래밍 언어
                %s

                ## 학생의 약점 스킬
                %s

                ## 제출 코드
                ```%s
                %s
                ```

                위 코드를 리뷰하고 라인별 피드백을 JSON으로 반환하세요.
                약점 스킬과 관련된 이슈가 있으면 twin_linked를 true로 표시하세요.
                """,
                language,
                weakSkills.isEmpty() ? "없음" : String.join(", ", weakSkills),
                language,
                code
        );

        Map<String, Object> gptResponse = callGpt4o(SYSTEM_PROMPT, userPrompt);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> feedbackMaps =
                (List<Map<String, Object>>) gptResponse.getOrDefault("feedbacks", List.of());

        List<CodeFeedback> savedFeedbacks = new ArrayList<>();
        for (Map<String, Object> fbMap : feedbackMaps) {
            Boolean twinLinked = (Boolean) fbMap.getOrDefault("twin_linked", false);
            String twinSkillName = (String) fbMap.get("twin_skill_name");
            CurriculumSkill twinSkill = twinLinked && twinSkillName != null
                    ? skillNameMap.get(twinSkillName) : null;

            CodeFeedback feedback = CodeFeedback.builder()
                    .submission(submission)
                    .lineNumber(toInteger(fbMap.get("line_number")))
                    .endLineNumber(toInteger(fbMap.get("end_line_number")))
                    .severity((String) fbMap.get("severity"))
                    .message((String) fbMap.get("message"))
                    .suggestion((String) fbMap.get("suggestion"))
                    .twinLinked(twinLinked)
                    .twinSkill(twinSkill)
                    .build();
            savedFeedbacks.add(codeFeedbackRepository.save(feedback));
        }

        // Update submission status
        submission.setStatus("REVIEWED");
        codeSubmissionRepository.save(submission);

        log.info("코드 리뷰 완료 - submissionId={}, 피드백 {}건", submissionId, savedFeedbacks.size());

        return Map.of(
                "submissionId", submissionId,
                "feedbackCount", savedFeedbacks.size(),
                "score", gptResponse.getOrDefault("score", 0),
                "overallSummary", gptResponse.getOrDefault("overall_summary", ""),
                "strengths", gptResponse.getOrDefault("strengths", List.of()),
                "improvementAreas", gptResponse.getOrDefault("improvement_areas", List.of()),
                "feedbacks", feedbackMaps
        );
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
                "temperature", 0.4
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

    private Integer toInteger(Object value) {
        if (value == null) return null;
        if (value instanceof Number) return ((Number) value).intValue();
        try {
            return Integer.parseInt(value.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
