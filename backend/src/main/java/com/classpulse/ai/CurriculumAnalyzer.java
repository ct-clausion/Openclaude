package com.classpulse.ai;

import com.classpulse.domain.course.Course;
import com.classpulse.domain.course.CourseRepository;
import com.classpulse.domain.course.CourseWeek;
import com.classpulse.domain.course.CurriculumSkill;
import com.classpulse.domain.course.CurriculumSkillRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * AI Engine 1 - 커리큘럼 분석기
 * 강의 자료 텍스트와 학습 목표를 분석하여 스킬 원자, 선수 지식, 주별 핵심 개념,
 * 흔한 오개념, 복습 포인트를 추출합니다.
 */
@Slf4j
@Service
public class CurriculumAnalyzer {

    private final RestTemplate openAiRestTemplate;
    private final CourseRepository courseRepository;
    private final CurriculumSkillRepository curriculumSkillRepository;
    private final ObjectMapper objectMapper;

    public CurriculumAnalyzer(
            @Qualifier("openAiRestTemplate") RestTemplate openAiRestTemplate,
            CourseRepository courseRepository,
            CurriculumSkillRepository curriculumSkillRepository,
            ObjectMapper objectMapper) {
        this.openAiRestTemplate = openAiRestTemplate;
        this.courseRepository = courseRepository;
        this.curriculumSkillRepository = curriculumSkillRepository;
        this.objectMapper = objectMapper;
    }

    private static final String SYSTEM_PROMPT = """
        당신은 대학 교육과정 분석 전문 AI입니다.
        교수자가 제공한 강의 자료와 학습 목표를 분석하여 구조화된 커리큘럼 데이터를 생성합니다.

        반드시 다음 JSON 형식으로 응답하세요:
        {
          "skills": [
            {
              "name": "스킬 이름 (예: 변수와 자료형)",
              "description": "해당 스킬에 대한 간결한 설명",
              "difficulty": "EASY | MEDIUM | HARD",
              "prerequisite_names": ["선수 스킬 이름1", "선수 스킬 이름2"]
            }
          ],
          "weekly_concepts": [
            {
              "week": 1,
              "title": "주차 제목",
              "key_concepts": ["핵심 개념1", "핵심 개념2"],
              "summary": "주차 요약"
            }
          ],
          "common_misconceptions": [
            {
              "skill_name": "관련 스킬 이름",
              "misconception": "흔한 오개념 설명",
              "correction": "올바른 이해 방향"
            }
          ],
          "review_points": [
            {
              "skill_name": "관련 스킬 이름",
              "review_reason": "복습이 필요한 이유",
              "suggested_interval_days": 7
            }
          ]
        }

        분석 시 다음 원칙을 따르세요:
        1. 스킬은 가능한 원자적(atomic) 단위로 분해하세요.
        2. 선수 지식 관계를 명확히 정의하세요 (사이클 없이).
        3. 난이도는 학습자 관점에서 평가하세요.
        4. 오개념은 실제 교육 현장에서 자주 나타나는 것을 중심으로 작성하세요.
        5. 복습 주기는 에빙하우스 망각 곡선을 참고하여 제안하세요.
        """;

    @Transactional
    public Map<String, Object> analyze(Long courseId, String materialsText, String objectives) {
        // Cap upload size before prompt assembly — 60k chars ~= 15k tokens on OpenAI.
        materialsText = AiInputGuard.truncate(materialsText, AiInputGuard.MAX_CURRICULUM_CHARS);

        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new IllegalArgumentException("Course not found: " + courseId));

        // 과정 기간 계산
        int totalDays = 0;
        int weekCount = 0;
        String durationInfo = "";
        if (course.getStartDate() != null && course.getEndDate() != null) {
            totalDays = (int) ChronoUnit.DAYS.between(course.getStartDate(), course.getEndDate()) + 1;
            weekCount = Math.max(1, (int) Math.ceil(totalDays / 7.0));
            durationInfo = String.format("""
                - 시작일: %s
                - 종료일: %s
                - 총 기간: %d일 (%d주)
                ⚠️ 중요: weekly_concepts는 반드시 %d주 이하로 생성하세요. 기간이 7일 미만이면 1주로, 7~13일이면 2주 이하로 생성하세요.
                """,
                    course.getStartDate(), course.getEndDate(), totalDays, weekCount, weekCount);
        }

        String userPrompt = String.format("""
                ## 강의 정보
                - 강의명: %s
                - 강의 설명: %s
                %s

                ## 학습 목표
                %s

                ## 강의 자료 내용
                %s

                위 내용을 분석하여 스킬 원자, 선수 지식 관계, 주별 핵심 개념, 흔한 오개념, 복습 포인트를 JSON으로 반환하세요.
                %s
                """,
                course.getTitle(),
                course.getDescription() != null ? course.getDescription() : "",
                durationInfo,
                objectives,
                materialsText,
                weekCount > 0 ? "⚠️ weekly_concepts의 week 수는 최대 " + weekCount + "주까지만 생성하세요!" : ""
        );

        Map<String, Object> gptResponse = callGpt4o(SYSTEM_PROMPT, userPrompt);

        // Parse and save skills
        List<Map<String, Object>> skillMaps = getListFromResponse(gptResponse, "skills");
        Map<String, CurriculumSkill> savedSkills = new LinkedHashMap<>();

        // First pass: create all skills without prerequisites
        for (Map<String, Object> skillMap : skillMaps) {
            CurriculumSkill skill = CurriculumSkill.builder()
                    .course(course)
                    .name((String) skillMap.get("name"))
                    .description((String) skillMap.get("description"))
                    .difficulty((String) skillMap.getOrDefault("difficulty", "MEDIUM"))
                    .build();
            CurriculumSkill saved = curriculumSkillRepository.save(skill);
            savedSkills.put(saved.getName(), saved);
        }

        // Second pass: link prerequisites
        for (Map<String, Object> skillMap : skillMaps) {
            String skillName = (String) skillMap.get("name");
            CurriculumSkill skill = savedSkills.get(skillName);
            if (skill == null) continue;

            @SuppressWarnings("unchecked")
            List<String> prereqNames = (List<String>) skillMap.getOrDefault("prerequisite_names", List.of());
            Set<CurriculumSkill> prereqs = prereqNames.stream()
                    .map(savedSkills::get)
                    .filter(Objects::nonNull)
                    .collect(Collectors.toSet());

            if (!prereqs.isEmpty()) {
                skill.setPrerequisites(prereqs);
                curriculumSkillRepository.save(skill);
            }
        }

        // Save weekly concepts as CourseWeek records (과정 기간에 맞게 제한)
        List<Map<String, Object>> weeklyConcepts = getListFromResponse(gptResponse, "weekly_concepts");
        if (!weeklyConcepts.isEmpty() && course.getWeeks().isEmpty()) {
            // AI가 과정 기간보다 많은 주차를 생성했을 수 있으므로 강제 제한
            int maxWeeks = weekCount > 0 ? weekCount : weeklyConcepts.size();
            List<Map<String, Object>> limitedWeeks = weeklyConcepts.size() > maxWeeks
                    ? weeklyConcepts.subList(0, maxWeeks) : weeklyConcepts;

            for (Map<String, Object> wc : limitedWeeks) {
                int weekNo = wc.get("week") instanceof Number ? ((Number) wc.get("week")).intValue() : 0;
                String title = (String) wc.getOrDefault("title", "Week " + weekNo);
                String summary = (String) wc.getOrDefault("summary", "");
                CourseWeek week = CourseWeek.builder()
                        .course(course)
                        .weekNo(weekNo)
                        .title(title)
                        .summary(summary)
                        .build();
                course.getWeeks().add(week);
            }
            courseRepository.save(course);
            log.info("주차 정보 {}개 저장 (최대 {}주 제한) - courseId={}", limitedWeeks.size(), maxWeeks, courseId);
        }

        log.info("커리큘럼 분석 완료 - courseId={}, 스킬 {}개 생성", courseId, savedSkills.size());

        return Map.of(
                "courseId", courseId,
                "skillCount", savedSkills.size(),
                "skills", skillMaps,
                "weekly_concepts", getListFromResponse(gptResponse, "weekly_concepts"),
                "common_misconceptions", getListFromResponse(gptResponse, "common_misconceptions"),
                "review_points", getListFromResponse(gptResponse, "review_points")
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
                "temperature", 0.7
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

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> getListFromResponse(Map<String, Object> response, String key) {
        Object value = response.get(key);
        if (value instanceof List) {
            return (List<Map<String, Object>>) value;
        }
        return List.of();
    }
}
