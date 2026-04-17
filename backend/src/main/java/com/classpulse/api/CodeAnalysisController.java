package com.classpulse.api;

import com.classpulse.ai.CodeReviewAi;
import com.classpulse.ai.TwinInferenceDebouncer;
import com.classpulse.config.SecurityUtil;
import com.classpulse.domain.codeanalysis.CodeFeedback;
import com.classpulse.domain.codeanalysis.CodeFeedbackRepository;
import com.classpulse.domain.codeanalysis.CodeSubmission;
import com.classpulse.domain.codeanalysis.CodeSubmissionRepository;
import com.classpulse.domain.course.AsyncJob;
import com.classpulse.domain.course.AsyncJobRepository;
import com.classpulse.domain.course.Course;
import com.classpulse.domain.course.CourseRepository;
import com.classpulse.domain.course.CurriculumSkill;
import com.classpulse.domain.course.CurriculumSkillRepository;
import com.classpulse.domain.user.User;
import com.classpulse.domain.user.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/code-analysis")
@RequiredArgsConstructor
public class CodeAnalysisController {

    private final CodeSubmissionRepository submissionRepository;
    private final CodeFeedbackRepository feedbackRepository;
    private final AsyncJobRepository asyncJobRepository;
    private final UserService userService;
    private final CourseRepository courseRepository;
    private final CodeAnalysisAsyncService codeAnalysisAsyncService;

    // --- DTOs ---

    public record SubmitCodeRequest(
            Long courseId, Long skillId,
            String codeContent, String language
    ) {}

    public record SubmissionResponse(
            Long submissionId, Long jobId, String status
    ) {}

    public record FeedbackResponse(
            Long id, Long submissionId,
            Integer lineNumber, Integer endLineNumber,
            String severity, String message, String suggestion,
            Boolean twinLinked, Long twinSkillId,
            LocalDateTime createdAt
    ) {
        public static FeedbackResponse from(CodeFeedback f) {
            return new FeedbackResponse(
                    f.getId(), f.getSubmission().getId(),
                    f.getLineNumber(), f.getEndLineNumber(),
                    f.getSeverity(), f.getMessage(), f.getSuggestion(),
                    f.getTwinLinked(),
                    f.getTwinSkill() != null ? f.getTwinSkill().getId() : null,
                    f.getCreatedAt()
            );
        }
    }

    public record SubmissionDetailResponse(
            Long id, Long studentId, Long courseId, Long skillId,
            String codeContent, String language, String status,
            List<FeedbackResponse> feedbacks, LocalDateTime createdAt
    ) {
        public static SubmissionDetailResponse from(CodeSubmission s, List<CodeFeedback> feedbacks) {
            return new SubmissionDetailResponse(
                    s.getId(), s.getStudent().getId(), s.getCourse().getId(),
                    s.getSkill() != null ? s.getSkill().getId() : null,
                    s.getCodeContent(), s.getLanguage(), s.getStatus(),
                    feedbacks.stream().map(FeedbackResponse::from).toList(),
                    s.getCreatedAt()
            );
        }
    }

    // --- Endpoints ---

    @PostMapping("/submit")
    public ResponseEntity<SubmissionResponse> submit(@RequestBody SubmitCodeRequest request) {
        Long userId = SecurityUtil.getCurrentUserId();
        User student = userService.findById(userId);
        Course course = courseRepository.findById(request.courseId())
                .orElseThrow(() -> new IllegalArgumentException("Course not found: " + request.courseId()));

        CodeSubmission submission = CodeSubmission.builder()
                .student(student)
                .course(course)
                .codeContent(request.codeContent())
                .language(request.language() != null ? request.language() : "javascript")
                .status("PENDING")
                .build();
        submission = submissionRepository.save(submission);

        AsyncJob job = AsyncJob.builder()
                .jobType("CODE_ANALYSIS")
                .status("PENDING")
                .inputPayload(Map.of(
                        "submissionId", submission.getId(),
                        "language", submission.getLanguage()
                ))
                .build();
        job = asyncJobRepository.save(job);

        codeAnalysisAsyncService.analyzeCode(job.getId(), submission.getId());

        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(new SubmissionResponse(submission.getId(), job.getId(), "PENDING"));
    }

    @GetMapping("/{submissionId}/feedback")
    public ResponseEntity<SubmissionDetailResponse> getFeedback(@PathVariable Long submissionId) {
        CodeSubmission submission = submissionRepository.findById(submissionId)
                .orElseThrow(() -> new IllegalArgumentException("Submission not found: " + submissionId));
        verifyAccessToStudent(submission.getStudent().getId());
        List<CodeFeedback> feedbacks = feedbackRepository.findBySubmissionId(submissionId);
        return ResponseEntity.ok(SubmissionDetailResponse.from(submission, feedbacks));
    }

    @GetMapping("/history")
    public ResponseEntity<List<SubmissionDetailResponse>> getHistory(
            @RequestParam Long studentId,
            @RequestParam(defaultValue = "50") int limit) {
        verifyAccessToStudent(studentId);
        // Cap the page size to prevent the server from materializing an unbounded list
        // when a veteran student has thousands of submissions.
        int safeLimit = Math.max(1, Math.min(limit, 200));
        List<CodeSubmission> submissions = submissionRepository
                .findByStudentIdOrderByCreatedAtDesc(studentId,
                        org.springframework.data.domain.PageRequest.of(0, safeLimit));
        // Batch-fetch all feedbacks in one query to avoid N+1
        List<Long> submissionIds = submissions.stream().map(CodeSubmission::getId).toList();
        Map<Long, List<CodeFeedback>> feedbacksBySubmission = submissionIds.isEmpty()
                ? Map.of()
                : feedbackRepository.findBySubmissionIdIn(submissionIds).stream()
                        .collect(java.util.stream.Collectors.groupingBy(f -> f.getSubmission().getId()));
        return ResponseEntity.ok(submissions.stream()
                .map(s -> SubmissionDetailResponse.from(s, feedbacksBySubmission.getOrDefault(s.getId(), List.of())))
                .toList());
    }

    private void verifyAccessToStudent(Long studentId) {
        Long userId = SecurityUtil.getCurrentUserId();
        if (userId.equals(studentId)) return;
        User currentUser = userService.findById(userId);
        if (currentUser.getRole() == User.Role.INSTRUCTOR) return;
        throw new SecurityException("Access denied");
    }

    // --- Async Service ---

    @Slf4j
    @Service
    @RequiredArgsConstructor
    static class CodeAnalysisAsyncService {

        private final AsyncJobRepository asyncJobRepository;
        private final CodeSubmissionRepository submissionRepository;
        private final CodeFeedbackRepository feedbackRepository;
        private final CodeReviewAi codeReviewAi;
        private final TwinInferenceDebouncer twinInferenceDebouncer;

        @Async("aiTaskExecutor")
        public void analyzeCode(Long jobId, Long submissionId) {
            AsyncJob job = asyncJobRepository.findById(jobId).orElseThrow();
            try {
                job.setStatus("PROCESSING");
                asyncJobRepository.save(job);

                log.info("Analyzing code submission {} via CodeReviewAi", submissionId);

                // Call CodeReviewAi which analyzes the code, creates CodeFeedback entries,
                // and updates the submission status to REVIEWED
                Map<String, Object> reviewResult = codeReviewAi.review(submissionId);

                job.complete(Map.of(
                        "submissionId", submissionId,
                        "feedbackCount", reviewResult.getOrDefault("feedbackCount", 0),
                        "score", reviewResult.getOrDefault("score", 0),
                        "overallSummary", reviewResult.getOrDefault("overallSummary", "")
                ));
                asyncJobRepository.save(job);

                // Trigger debounced twin inference after code analysis
                CodeSubmission sub = submissionRepository.findById(submissionId).orElse(null);
                if (sub != null) {
                    twinInferenceDebouncer.requestInference(
                            sub.getStudent().getId(), sub.getCourse().getId(), "CODE_SUBMISSION");
                }

            } catch (Exception e) {
                log.error("Code analysis failed for submission {}", submissionId, e);
                CodeSubmission submission = submissionRepository.findById(submissionId).orElse(null);
                if (submission != null) {
                    submission.setStatus("FAILED");
                    submissionRepository.save(submission);
                }
                job.fail(e.getMessage());
                asyncJobRepository.save(job);
            }
        }
    }
}
