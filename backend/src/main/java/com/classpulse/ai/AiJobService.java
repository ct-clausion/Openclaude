package com.classpulse.ai;

import com.classpulse.domain.course.AsyncJob;
import com.classpulse.domain.course.AsyncJobRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

/**
 * Central async job orchestrator.
 * Creates/updates AsyncJob records and delegates to specific AI engine services.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiJobService {

    private final AsyncJobRepository asyncJobRepository;
    private final CurriculumAnalyzer curriculumAnalyzer;
    private final QuestionGenerator questionGenerator;
    private final TwinInferenceEngine twinInferenceEngine;
    private final ConsultationCopilot consultationCopilot;
    private final RecommendationAi recommendationAi;
    private final ChatbotAi chatbotAi;
    private final CodeReviewAi codeReviewAi;
    private final StudyGroupMatcherAi studyGroupMatcherAi;

    // ── Curriculum Analysis ──────────────────────────────────────────────

    @Async("aiTaskExecutor")
    public void runCurriculumAnalysis(Long courseId, String materialsText, String objectives) {
        AsyncJob job = createJob("CURRICULUM_ANALYSIS",
                Map.of("courseId", courseId, "objectives", objectives));
        try {
            log.info("[AI Job {}] 커리큘럼 분석 시작 - courseId={}", job.getId(), courseId);
            Map<String, Object> result = curriculumAnalyzer.analyze(courseId, materialsText, objectives);
            completeJob(job, result);
            log.info("[AI Job {}] 커리큘럼 분석 완료", job.getId());
        } catch (Exception e) {
            failJob(job, e);
            log.error("[AI Job {}] 커리큘럼 분석 실패: {}", job.getId(), e.getMessage(), e);
        }
    }

    // ── Question Generation ──────────────────────────────────────────────

    @Async("aiTaskExecutor")
    public void runQuestionGeneration(Long courseId, Long skillId, String difficulty, int count) {
        AsyncJob job = createJob("QUESTION_GENERATION",
                Map.of("courseId", courseId, "skillId", skillId != null ? skillId : 0, "difficulty", difficulty, "count", count));
        try {
            log.info("[AI Job {}] 문제 생성 시작 - courseId={}, skillId={}, difficulty={}", job.getId(), courseId, skillId, difficulty);
            Map<String, Object> result = questionGenerator.generate(courseId, skillId, difficulty, count);
            completeJob(job, result);
            log.info("[AI Job {}] 문제 생성 완료 - {} 문제 생성됨", job.getId(), result.get("generatedCount"));
        } catch (Exception e) {
            failJob(job, e);
            log.error("[AI Job {}] 문제 생성 실패: {}", job.getId(), e.getMessage(), e);
        }
    }

    // ── Twin Inference ───────────────────────────────────────────────────

    @Async("aiTaskExecutor")
    public void runTwinInference(Long studentId, Long courseId) {
        runTwinInference(studentId, courseId, "SYSTEM");
    }

    @Async("aiTaskExecutor")
    public void runTwinInference(Long studentId, Long courseId, String inferenceSource) {
        AsyncJob job = createJob("TWIN_INFERENCE",
                Map.of("studentId", studentId, "courseId", courseId, "source", inferenceSource));
        try {
            log.info("[AI Job {}] 트윈 추론 시작 - studentId={}, courseId={}, source={}",
                    job.getId(), studentId, courseId, inferenceSource);
            Map<String, Object> result = twinInferenceEngine.infer(studentId, courseId, inferenceSource);
            completeJob(job, result);
            log.info("[AI Job {}] 트윈 추론 완료", job.getId());
        } catch (Exception e) {
            failJob(job, e);
            log.error("[AI Job {}] 트윈 추론 실패: {}", job.getId(), e.getMessage(), e);
        }
    }

    // ── Consultation Briefing ────────────────────────────────────────────

    @Async("aiTaskExecutor")
    public void runConsultationBriefing(Long consultationId) {
        AsyncJob job = createJob("CONSULTATION_BRIEFING",
                Map.of("consultationId", consultationId));
        try {
            log.info("[AI Job {}] 상담 브리핑 생성 시작 - consultationId={}", job.getId(), consultationId);
            Map<String, Object> result = consultationCopilot.generateBriefing(consultationId);
            completeJob(job, result);
            log.info("[AI Job {}] 상담 브리핑 생성 완료", job.getId());
        } catch (Exception e) {
            failJob(job, e);
            log.error("[AI Job {}] 상담 브리핑 생성 실패: {}", job.getId(), e.getMessage(), e);
        }
    }

    // ── Consultation Summary ─────────────────────────────────────────────

    @Async("aiTaskExecutor")
    public void runConsultationSummary(Long consultationId, String notes) {
        AsyncJob job = createJob("CONSULTATION_SUMMARY",
                Map.of("consultationId", consultationId));
        try {
            log.info("[AI Job {}] 상담 요약 생성 시작 - consultationId={}", job.getId(), consultationId);
            Map<String, Object> result = consultationCopilot.generateSummary(consultationId, notes);
            completeJob(job, result);
            log.info("[AI Job {}] 상담 요약 생성 완료", job.getId());
        } catch (Exception e) {
            failJob(job, e);
            log.error("[AI Job {}] 상담 요약 생성 실패: {}", job.getId(), e.getMessage(), e);
        }
    }

    // ── Recommendation ───────────────────────────────────────────────────

    @Async("aiTaskExecutor")
    public void runRecommendation(Long studentId, Long courseId) {
        AsyncJob job = createJob("RECOMMENDATION",
                Map.of("studentId", studentId, "courseId", courseId));
        try {
            log.info("[AI Job {}] 추천 생성 시작 - studentId={}, courseId={}", job.getId(), studentId, courseId);
            Map<String, Object> result = recommendationAi.generateRecommendations(studentId, courseId);
            completeJob(job, result);
            log.info("[AI Job {}] 추천 생성 완료", job.getId());
        } catch (Exception e) {
            failJob(job, e);
            log.error("[AI Job {}] 추천 생성 실패: {}", job.getId(), e.getMessage(), e);
        }
    }

    // ── Code Review ──────────────────────────────────────────────────────

    @Async("aiTaskExecutor")
    public void runCodeReview(Long submissionId) {
        AsyncJob job = createJob("CODE_REVIEW",
                Map.of("submissionId", submissionId));
        try {
            log.info("[AI Job {}] 코드 리뷰 시작 - submissionId={}", job.getId(), submissionId);
            Map<String, Object> result = codeReviewAi.review(submissionId);
            completeJob(job, result);
            log.info("[AI Job {}] 코드 리뷰 완료", job.getId());
        } catch (Exception e) {
            failJob(job, e);
            log.error("[AI Job {}] 코드 리뷰 실패: {}", job.getId(), e.getMessage(), e);
        }
    }

    // ── Study Group Matching ─────────────────────────────────────────────

    @Async("aiTaskExecutor")
    public void runStudyGroupMatching(Long studentId, Long courseId) {
        AsyncJob job = createJob("STUDY_GROUP_MATCHING",
                Map.of("studentId", studentId, "courseId", courseId));
        try {
            log.info("[AI Job {}] 스터디 그룹 매칭 시작 - studentId={}, courseId={}", job.getId(), studentId, courseId);
            Map<String, Object> result = studyGroupMatcherAi.findMatches(studentId, courseId);
            completeJob(job, result);
            log.info("[AI Job {}] 스터디 그룹 매칭 완료", job.getId());
        } catch (Exception e) {
            failJob(job, e);
            log.error("[AI Job {}] 스터디 그룹 매칭 실패: {}", job.getId(), e.getMessage(), e);
        }
    }

    // ── Job lifecycle helpers ────────────────────────────────────────────

    @Transactional
    protected AsyncJob createJob(String jobType, Map<String, Object> inputPayload) {
        AsyncJob job = AsyncJob.builder()
                .jobType(jobType)
                .status("PROCESSING")
                .inputPayload(inputPayload)
                .build();
        return asyncJobRepository.save(job);
    }

    @Transactional
    protected void completeJob(AsyncJob job, Map<String, Object> result) {
        job.complete(result);
        asyncJobRepository.save(job);
    }

    @Transactional
    protected void failJob(AsyncJob job, Exception e) {
        job.fail(e.getMessage());
        asyncJobRepository.save(job);
    }

    /**
     * 비동기 작업 상태 조회
     */
    public AsyncJob getJobStatus(Long jobId) {
        return asyncJobRepository.findById(jobId)
                .orElseThrow(() -> new IllegalArgumentException("Job not found: " + jobId));
    }
}
