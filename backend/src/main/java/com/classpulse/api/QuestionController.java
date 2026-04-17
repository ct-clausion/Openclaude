package com.classpulse.api;

import com.classpulse.ai.QuestionGenerator;
import com.classpulse.config.CourseAccessGuard;
import com.classpulse.config.SecurityUtil;
import com.classpulse.domain.course.*;
import com.classpulse.domain.learning.Question;
import com.classpulse.domain.user.User;
import com.classpulse.domain.user.UserService;
import com.classpulse.domain.learning.QuestionRepository;
import com.classpulse.domain.learning.ReviewTask;
import com.classpulse.domain.learning.ReviewTaskRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequiredArgsConstructor
public class QuestionController {

    private final QuestionRepository questionRepository;
    private final ReviewTaskRepository reviewTaskRepository;
    private final CourseRepository courseRepository;
    private final CurriculumSkillRepository skillRepository;
    private final AsyncJobRepository asyncJobRepository;
    private final QuestionGenerator questionGenerator;
    private final QuestionGenerationService questionGenerationService;
    private final UserService userService;
    private final CourseAccessGuard courseAccessGuard;

    /** Ensures the current user owns the course this question belongs to. */
    private void assertOwnsQuestion(Question question) {
        Long courseId = question.getCourse() != null ? question.getCourse().getId() : null;
        if (courseId == null) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "Question is not linked to a course");
        }
        courseAccessGuard.assertInstructorOwns(courseId, SecurityUtil.getCurrentUserId());
    }

    // --- DTOs ---

    public record GenerateRequest(Long skillId, String difficulty, int count) {}

    public record CreateQuestionRequest(
            Long courseId, Long skillId, String questionType,
            String difficulty, String content, String answer, String explanation
    ) {}

    public record UpdateQuestionRequest(
            String questionType, String difficulty, String content,
            String answer, String explanation
    ) {}

    public record QuestionResponse(
            Long id, Long courseId, Long skillId, String questionType,
            String difficulty, String content, String answer,
            String explanation, String approvalStatus, String generationReason
    ) {
        public static QuestionResponse from(Question q) {
            return new QuestionResponse(
                    q.getId(),
                    q.getCourse().getId(),
                    q.getSkill() != null ? q.getSkill().getId() : null,
                    q.getQuestionType(),
                    q.getDifficulty(),
                    q.getContent(),
                    q.getAnswer(),
                    q.getExplanation(),
                    q.getApprovalStatus(),
                    q.getGenerationReason()
            );
        }
    }

    public record JobIdResponse(Long jobId) {}

    public record PracticeQuestionResponse(
            String id,
            Long courseId,
            Long skillId,
            Long reviewTaskId,
            String taskTitle,
            String reasonSummary,
            String questionType,
            String difficulty,
            String content,
            String answer,
            String explanation,
            String generationReason,
            String approvalStatus,
            String source
    ) {
        public static PracticeQuestionResponse from(
                Map<String, Object> payload,
                Long reviewTaskId,
                String taskTitle,
                String reasonSummary
        ) {
            return new PracticeQuestionResponse(
                    String.valueOf(payload.get("id")),
                    asLong(payload.get("courseId")),
                    asLong(payload.get("skillId")),
                    reviewTaskId,
                    taskTitle,
                    reasonSummary,
                    asString(payload.get("questionType")),
                    asString(payload.get("difficulty")),
                    asString(payload.get("content")),
                    asString(payload.get("answer")),
                    asString(payload.get("explanation")),
                    asString(payload.get("generationReason")),
                    asString(payload.get("approvalStatus")),
                    asString(payload.get("source"))
            );
        }
    }

    public record EvaluatePracticeRequest(
            Long reviewTaskId,
            Long courseId,
            Long skillId,
            String questionType,
            String questionContent,
            String referenceAnswer,
            String explanation,
            String studentAnswer
    ) {}

    public record PracticeEvaluationResponse(
            int score,
            boolean passed,
            String verdict,
            List<String> strengths,
            List<String> improvements,
            String modelAnswer,
            String coachingTip
    ) {
        @SuppressWarnings("unchecked")
        public static PracticeEvaluationResponse from(Map<String, Object> payload) {
            return new PracticeEvaluationResponse(
                    payload.get("score") instanceof Number number ? number.intValue() : 0,
                    payload.get("passed") instanceof Boolean passed && passed,
                    asString(payload.get("verdict")),
                    (List<String>) payload.getOrDefault("strengths", List.of()),
                    (List<String>) payload.getOrDefault("improvements", List.of()),
                    asString(payload.get("modelAnswer")),
                    asString(payload.get("coachingTip"))
            );
        }
    }

    // --- Endpoints ---

    @PostMapping("/api/courses/{courseId}/questions/generate")
    public ResponseEntity<JobIdResponse> generate(
            @PathVariable Long courseId,
            @RequestBody GenerateRequest request
    ) {
        courseAccessGuard.assertInstructorOwns(courseId, SecurityUtil.getCurrentUserId());

        AsyncJob job = AsyncJob.builder()
                .jobType("QUESTION_GENERATION")
                .status("PENDING")
                .inputPayload(Map.of(
                        "courseId", courseId,
                        "skillId", request.skillId() != null ? request.skillId() : 0,
                        "difficulty", request.difficulty() != null ? request.difficulty() : "MEDIUM",
                        "count", request.count() > 0 ? request.count() : 5
                ))
                .build();
        job = asyncJobRepository.save(job);

        questionGenerationService.generateQuestions(job.getId(), courseId, request);

        return ResponseEntity.status(HttpStatus.ACCEPTED).body(new JobIdResponse(job.getId()));
    }

    @Transactional(readOnly = true)
    @GetMapping("/api/questions")
    public ResponseEntity<List<QuestionResponse>> list(
            @RequestParam Long courseId,
            @RequestParam(required = false) Long skillId,
            @RequestParam(required = false) String approvalStatus
    ) {
        List<Question> questions;
        if (skillId != null && approvalStatus != null) {
            questions = questionRepository.findByCourseIdAndSkillIdAndApprovalStatus(courseId, skillId, approvalStatus);
        } else if (skillId != null) {
            questions = questionRepository.findByCourseIdAndSkillId(courseId, skillId);
        } else if (approvalStatus != null) {
            questions = questionRepository.findByCourseIdAndApprovalStatus(courseId, approvalStatus);
        } else {
            questions = questionRepository.findByCourseId(courseId);
        }
        return ResponseEntity.ok(questions.stream().map(QuestionResponse::from).toList());
    }

    @Transactional(readOnly = true)
    @GetMapping("/api/questions/practice")
    public ResponseEntity<PracticeQuestionResponse> getPracticeQuestion(
            @RequestParam Long courseId,
            @RequestParam(required = false) Long skillId,
            @RequestParam(required = false) Long reviewTaskId
    ) {
        ReviewTask reviewTask = loadOwnedReviewTask(reviewTaskId);
        Long effectiveCourseId = reviewTask != null ? reviewTask.getCourse().getId() : courseId;
        Long effectiveSkillId = reviewTask != null && reviewTask.getSkill() != null
                ? reviewTask.getSkill().getId()
                : skillId;

        Map<String, Object> question = questionGenerator.getPracticeQuestion(
                effectiveCourseId,
                effectiveSkillId,
                reviewTask != null ? reviewTask.getTitle() : null,
                reviewTask != null ? reviewTask.getReasonSummary() : null
        );

        return ResponseEntity.ok(PracticeQuestionResponse.from(
                question,
                reviewTaskId,
                reviewTask != null ? reviewTask.getTitle() : null,
                reviewTask != null ? reviewTask.getReasonSummary() : null
        ));
    }

    @PostMapping("/api/questions/practice/evaluate")
    public ResponseEntity<PracticeEvaluationResponse> evaluatePracticeAnswer(
            @RequestBody EvaluatePracticeRequest request
    ) {
        loadOwnedReviewTask(request.reviewTaskId());

        Map<String, Object> evaluation = questionGenerator.evaluatePracticeAnswer(
                request.courseId(),
                request.skillId(),
                request.questionType(),
                request.questionContent(),
                request.referenceAnswer(),
                request.explanation(),
                request.studentAnswer()
        );

        return ResponseEntity.ok(PracticeEvaluationResponse.from(evaluation));
    }

    @PutMapping("/api/questions/{id}/approve")
    public ResponseEntity<QuestionResponse> approve(@PathVariable Long id) {
        verifyInstructorRole();
        Question question = questionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Question not found: " + id));
        assertOwnsQuestion(question);
        question.setApprovalStatus("APPROVED");
        question = questionRepository.save(question);
        return ResponseEntity.ok(QuestionResponse.from(question));
    }

    @PutMapping("/api/questions/{id}/reject")
    public ResponseEntity<QuestionResponse> reject(@PathVariable Long id) {
        verifyInstructorRole();
        Question question = questionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Question not found: " + id));
        assertOwnsQuestion(question);
        question.setApprovalStatus("REJECTED");
        question = questionRepository.save(question);
        return ResponseEntity.ok(QuestionResponse.from(question));
    }

    @PostMapping("/api/questions")
    public ResponseEntity<QuestionResponse> create(@RequestBody CreateQuestionRequest request) {
        verifyInstructorRole();
        Course course = courseAccessGuard.assertInstructorOwns(request.courseId(), SecurityUtil.getCurrentUserId());

        Question question = Question.builder()
                .course(course)
                .questionType(request.questionType() != null ? request.questionType() : "서술형")
                .difficulty(request.difficulty() != null ? request.difficulty() : "MEDIUM")
                .content(request.content())
                .answer(request.answer())
                .explanation(request.explanation())
                .generationReason("수동 등록")
                .approvalStatus("APPROVED")
                .build();

        if (request.skillId() != null) {
            CurriculumSkill skill = skillRepository.findById(request.skillId()).orElse(null);
            question.setSkill(skill);
        }

        question = questionRepository.save(question);
        return ResponseEntity.status(HttpStatus.CREATED).body(QuestionResponse.from(question));
    }

    @PutMapping("/api/questions/{id}")
    public ResponseEntity<QuestionResponse> update(
            @PathVariable Long id,
            @RequestBody UpdateQuestionRequest request
    ) {
        verifyInstructorRole();
        Question question = questionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Question not found: " + id));
        assertOwnsQuestion(question);

        if (request.questionType() != null) question.setQuestionType(request.questionType());
        if (request.difficulty() != null) question.setDifficulty(request.difficulty());
        if (request.content() != null) question.setContent(request.content());
        if (request.answer() != null) question.setAnswer(request.answer());
        if (request.explanation() != null) question.setExplanation(request.explanation());

        question = questionRepository.save(question);
        return ResponseEntity.ok(QuestionResponse.from(question));
    }

    @DeleteMapping("/api/questions/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        verifyInstructorRole();
        Question question = questionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Question not found: " + id));
        assertOwnsQuestion(question);
        questionRepository.delete(question);
        return ResponseEntity.noContent().build();
    }

    private void verifyInstructorRole() {
        Long userId = SecurityUtil.getCurrentUserId();
        User currentUser = userService.findById(userId);
        if (currentUser.getRole() != User.Role.INSTRUCTOR) {
            throw new SecurityException("강사만 문제를 승인/거부할 수 있습니다.");
        }
    }

    private ReviewTask loadOwnedReviewTask(Long reviewTaskId) {
        if (reviewTaskId == null) {
            return null;
        }

        ReviewTask reviewTask = reviewTaskRepository.findById(reviewTaskId)
                .orElseThrow(() -> new IllegalArgumentException("Review task not found: " + reviewTaskId));
        Long userId = SecurityUtil.getCurrentUserId();
        if (!reviewTask.getStudent().getId().equals(userId)) {
            throw new IllegalArgumentException("Review task access denied: " + reviewTaskId);
        }
        return reviewTask;
    }

    private static String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static Long asLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value instanceof String text && !text.isBlank()) {
            return Long.parseLong(text);
        }
        return null;
    }

    // --- Async Service ---

    @Slf4j
    @Service
    @RequiredArgsConstructor
    static class QuestionGenerationService {

        private final AsyncJobRepository asyncJobRepository;
        private final QuestionRepository questionRepository;
        private final CourseRepository courseRepository;
        private final CurriculumSkillRepository skillRepository;
        private final QuestionGenerator questionGenerator;

        @Async("aiTaskExecutor")
        public void generateQuestions(Long jobId, Long courseId, GenerateRequest request) {
            AsyncJob job = asyncJobRepository.findById(jobId).orElseThrow();
            try {
                job.setStatus("PROCESSING");
                asyncJobRepository.save(job);

                String difficulty = request.difficulty() != null ? request.difficulty() : "MEDIUM";
                int count = request.count() > 0 ? request.count() : 5;

                log.info("Generating {} questions for course {}, skill {}, difficulty {}",
                        count, courseId, request.skillId(), difficulty);

                Map<String, Object> result = questionGenerator.generate(
                        courseId,
                        request.skillId(),
                        difficulty,
                        count
                );

                int generatedCount = (int) result.getOrDefault("generatedCount", 0);
                job.complete(Map.of(
                        "courseId", courseId,
                        "questionsGenerated", generatedCount,
                        "message", "Question generation completed"
                ));
                asyncJobRepository.save(job);

            } catch (Exception e) {
                log.error("Question generation failed for job {}", jobId, e);
                job.fail(e.getMessage());
                asyncJobRepository.save(job);
            }
        }
    }
}
