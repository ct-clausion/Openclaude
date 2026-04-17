package com.classpulse.api;

import com.classpulse.ai.TwinInferenceEngine;
import com.classpulse.config.CourseAccessGuard;
import com.classpulse.config.SecurityUtil;
import com.classpulse.domain.course.Course;
import com.classpulse.domain.course.CourseEnrollmentRepository;
import com.classpulse.domain.course.CourseRepository;
import com.classpulse.domain.learning.Reflection;
import com.classpulse.domain.learning.ReflectionRepository;
import com.classpulse.domain.learning.ReviewScheduler;
import com.classpulse.domain.twin.TwinService;
import com.classpulse.domain.user.User;
import com.classpulse.domain.user.UserService;
import com.classpulse.notification.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/reflections")
@RequiredArgsConstructor
public class ReflectionController {

    private final ReflectionRepository reflectionRepository;
    private final UserService userService;
    private final CourseRepository courseRepository;
    private final CourseEnrollmentRepository courseEnrollmentRepository;
    private final CourseAccessGuard courseAccessGuard;
    private final ReflectionTwinUpdateService reflectionTwinUpdateService;

    // --- DTOs ---

    public record CreateReflectionRequest(
            Long courseId,
            String content,
            String stuckPoint,
            Integer selfConfidenceScore
    ) {}

    public record ReflectionResponse(
            Long id, Long studentId, Long courseId,
            String content, String stuckPoint,
            Integer selfConfidenceScore,
            Map<String, Object> emotionSummary,
            Map<String, Object> aiAnalysisJson,
            LocalDateTime createdAt
    ) {
        public static ReflectionResponse from(Reflection r) {
            return new ReflectionResponse(
                    r.getId(),
                    r.getStudent().getId(),
                    r.getCourse().getId(),
                    r.getContent(),
                    r.getStuckPoint(),
                    r.getSelfConfidenceScore(),
                    r.getEmotionSummary(),
                    r.getAiAnalysisJson(),
                    r.getCreatedAt()
            );
        }
    }

    // --- Endpoints ---

    @PostMapping
    public ResponseEntity<ReflectionResponse> create(@RequestBody CreateReflectionRequest request) {
        Long userId = SecurityUtil.getCurrentUserId();
        User student = userService.findById(userId);
        Course course = courseRepository.findById(request.courseId())
                .orElseThrow(() -> new IllegalArgumentException("Course not found: " + request.courseId()));

        // Enrollment check: a student cannot submit reflections for a course they are not enrolled in.
        if (!courseEnrollmentRepository.existsByCourseIdAndStudentId(course.getId(), userId)) {
            throw new org.springframework.web.server.ResponseStatusException(
                    HttpStatus.FORBIDDEN, "Not enrolled in this course");
        }

        Reflection reflection = Reflection.builder()
                .student(student)
                .course(course)
                .content(request.content())
                .stuckPoint(request.stuckPoint())
                .selfConfidenceScore(request.selfConfidenceScore() != null ? request.selfConfidenceScore() : 3)
                .build();
        reflection = reflectionRepository.save(reflection);

        // Trigger async twin update based on new reflection data
        reflectionTwinUpdateService.updateTwinFromReflection(reflection.getId(), userId, request.courseId());

        return ResponseEntity.status(HttpStatus.CREATED).body(ReflectionResponse.from(reflection));
    }

    @GetMapping
    public ResponseEntity<List<ReflectionResponse>> list(
            @RequestParam Long studentId,
            @RequestParam(required = false) Long courseId) {
        verifyAccessToStudent(studentId, courseId);
        List<Reflection> reflections;
        if (courseId != null) {
            reflections = reflectionRepository.findByStudentIdAndCourseIdOrderByCreatedAtDesc(studentId, courseId);
        } else {
            reflections = reflectionRepository.findByStudentIdOrderByCreatedAtDesc(studentId);
        }
        return ResponseEntity.ok(reflections.stream().map(ReflectionResponse::from).toList());
    }

    /**
     * Access rules:
     *  - A student can always read their own reflections.
     *  - An instructor may read a student's reflections only when a specific courseId is
     *    supplied AND the instructor owns that course AND the student is enrolled in it.
     *    Instructors cannot browse across courses they don't own.
     */
    private void verifyAccessToStudent(Long studentId, Long courseId) {
        Long userId = SecurityUtil.getCurrentUserId();
        if (userId.equals(studentId)) return;

        User currentUser = userService.findById(userId);
        if (currentUser.getRole() != User.Role.INSTRUCTOR) {
            throw new org.springframework.web.server.ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
        if (courseId == null) {
            throw new org.springframework.web.server.ResponseStatusException(
                    HttpStatus.FORBIDDEN, "Instructors must specify a courseId they own");
        }
        courseAccessGuard.assertInstructorOwns(courseId, userId);
        if (!courseEnrollmentRepository.existsByCourseIdAndStudentId(courseId, studentId)) {
            throw new org.springframework.web.server.ResponseStatusException(
                    HttpStatus.FORBIDDEN, "Student is not enrolled in this course");
        }
    }

    // --- Async Service ---

    @Slf4j
    @Service
    @RequiredArgsConstructor
    static class ReflectionTwinUpdateService {

        private final ReflectionRepository reflectionRepository;
        private final TwinService twinService;
        private final TwinInferenceEngine twinInferenceEngine;
        private final ReviewScheduler reviewScheduler;
        private final NotificationService notificationService;
        private final UserService userService;
        private final CourseRepository courseRepository;

        @Async("aiTaskExecutor")
        public void updateTwinFromReflection(Long reflectionId, Long studentId, Long courseId) {
            try {
                Reflection reflection = reflectionRepository.findById(reflectionId).orElseThrow();
                User student = userService.findById(studentId);
                Course course = courseRepository.findById(courseId).orElseThrow();

                // Ensure twin exists
                twinService.getOrCreateTwin(student, course);

                log.info("Running full twin inference for student {} course {} from reflection {}",
                        studentId, courseId, reflectionId);

                // Run full TwinInferenceEngine (rule-based + LLM hybrid) to recalculate
                // all twin scores based on all data sources
                Map<String, Object> inferenceResult = twinInferenceEngine.infer(studentId, courseId, "REFLECTION");

                // Regenerate review tasks based on updated twin state
                reviewScheduler.generateReviewTasks(studentId, courseId);

                // Notify instructor if overall risk is high
                double overallRisk = ((Number) inferenceResult.getOrDefault("overallRiskScore", 0.0)).doubleValue();
                if (overallRisk >= 70) {
                    // Find the course instructor to notify
                    if (course.getCreatedBy() != null) {
                        notificationService.createNotification(
                                course.getCreatedBy().getId(),
                                "HIGH_RISK_STUDENT",
                                "학생 위험도 경고: " + student.getName(),
                                String.format("%s 학생의 종합 위험도가 %.0f%%로 높습니다. 상담을 고려해주세요.",
                                        student.getName(), overallRisk),
                                Map.of(
                                        "studentId", studentId,
                                        "courseId", courseId,
                                        "overallRiskScore", overallRisk
                                )
                        );
                    }
                }

            } catch (Exception e) {
                log.error("Failed to update twin from reflection {}", reflectionId, e);
            }
        }
    }
}
