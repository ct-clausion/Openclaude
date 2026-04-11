package com.classpulse.api;

import com.classpulse.config.SecurityUtil;
import com.classpulse.domain.course.Course;
import com.classpulse.domain.course.CourseEnrollment;
import com.classpulse.domain.course.CourseEnrollmentRepository;
import com.classpulse.domain.course.CourseRepository;
import com.classpulse.domain.twin.StudentTwin;
import com.classpulse.domain.twin.StudentTwinRepository;
import com.classpulse.domain.twin.TwinService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/instructor")
@RequiredArgsConstructor
public class InstructorStudentController {

    private final StudentTwinRepository twinRepository;
    private final CourseRepository courseRepository;
    private final CourseEnrollmentRepository enrollmentRepository;
    private final TwinService twinService;

    // ── DTOs ──

    public record HeatmapEntry(
            Long studentId, String studentName,
            BigDecimal overallRiskScore,
            BigDecimal masteryScore, BigDecimal motivationScore,
            String trendDirection
    ) {
        public static HeatmapEntry from(StudentTwin t) {
            return new HeatmapEntry(
                    t.getStudent().getId(), t.getStudent().getName(),
                    t.getOverallRiskScore(),
                    t.getMasteryScore(), t.getMotivationScore(),
                    t.getTrendDirection()
            );
        }
    }

    public record StudentTwinEntry(
            Long studentId, String studentName,
            BigDecimal masteryScore, BigDecimal executionScore,
            BigDecimal retentionRiskScore, BigDecimal motivationScore,
            BigDecimal consultationNeedScore, BigDecimal overallRiskScore,
            String aiInsight, String trendDirection, String updatedAt
    ) {
        public static StudentTwinEntry from(StudentTwin t) {
            return new StudentTwinEntry(
                    t.getStudent().getId(), t.getStudent().getName(),
                    t.getMasteryScore(), t.getExecutionScore(),
                    t.getRetentionRiskScore(), t.getMotivationScore(),
                    t.getConsultationNeedScore(), t.getOverallRiskScore(),
                    t.getAiInsight(), t.getTrendDirection(),
                    t.getUpdatedAt() != null ? t.getUpdatedAt().toString() : null
            );
        }
    }

    public record EnrollmentEntry(
            Long enrollmentId, Long studentId, String studentName,
            String studentEmail, String status, String enrolledAt
    ) {
        public static EnrollmentEntry from(CourseEnrollment e) {
            return new EnrollmentEntry(
                    e.getId(),
                    e.getStudent().getId(),
                    e.getStudent().getName(),
                    e.getStudent().getEmail(),
                    e.getStatus(),
                    e.getEnrolledAt() != null ? e.getEnrolledAt().toString() : null
            );
        }
    }

    // ── Heatmap & Students ──

    @GetMapping("/course/{courseId}/heatmap")
    @Transactional
    public ResponseEntity<List<HeatmapEntry>> getCourseHeatmap(@PathVariable Long courseId) {
        // ACTIVE 수강생 Twin 보장
        List<CourseEnrollment> activeEnrollments = enrollmentRepository.findByCourseIdAndStatus(courseId, "ACTIVE");
        for (CourseEnrollment enrollment : activeEnrollments) {
            twinService.getOrCreateTwin(enrollment.getStudent(), enrollment.getCourse());
        }

        List<StudentTwin> twins = twinRepository.findByCourseId(courseId);
        List<HeatmapEntry> entries = twins.stream()
                .map(HeatmapEntry::from)
                .sorted((a, b) -> a.studentName().compareTo(b.studentName()))
                .toList();
        return ResponseEntity.ok(entries);
    }

    @GetMapping("/course/{courseId}/students")
    @Transactional
    public ResponseEntity<List<StudentTwinEntry>> getCourseStudents(@PathVariable Long courseId) {
        // ACTIVE 수강생 중 Twin이 없는 학생이 있으면 자동 생성
        List<CourseEnrollment> activeEnrollments = enrollmentRepository.findByCourseIdAndStatus(courseId, "ACTIVE");
        for (CourseEnrollment enrollment : activeEnrollments) {
            twinService.getOrCreateTwin(enrollment.getStudent(), enrollment.getCourse());
        }

        List<StudentTwin> twins = twinRepository.findByCourseId(courseId);
        List<StudentTwinEntry> entries = twins.stream()
                .map(StudentTwinEntry::from)
                .toList();
        return ResponseEntity.ok(entries);
    }

    // ── 수강 승인 관리 ──

    @GetMapping("/course/{courseId}/enrollments")
    @Transactional(readOnly = true)
    public ResponseEntity<List<EnrollmentEntry>> getEnrollments(
            @PathVariable Long courseId,
            @RequestParam(required = false) String status
    ) {
        verifyInstructorOwnsCourse(courseId);
        List<CourseEnrollment> enrollments;
        if (status != null) {
            enrollments = enrollmentRepository.findByCourseIdAndStatus(courseId, status);
        } else {
            enrollments = enrollmentRepository.findByCourseId(courseId);
        }
        return ResponseEntity.ok(enrollments.stream().map(EnrollmentEntry::from).toList());
    }

    @PutMapping("/course/{courseId}/enrollments/{enrollmentId}/approve")
    @Transactional
    public ResponseEntity<EnrollmentEntry> approveEnrollment(
            @PathVariable Long courseId,
            @PathVariable Long enrollmentId
    ) {
        verifyInstructorOwnsCourse(courseId);
        CourseEnrollment enrollment = enrollmentRepository.findById(enrollmentId)
                .orElseThrow(() -> new IllegalArgumentException("수강 신청을 찾을 수 없습니다"));
        if (!enrollment.getCourse().getId().equals(courseId)) {
            return ResponseEntity.badRequest().build();
        }
        enrollment.setStatus("ACTIVE");
        enrollmentRepository.save(enrollment);

        // 승인 시 StudentTwin 생성 → 학생 모니터링에 표시
        twinService.getOrCreateTwin(enrollment.getStudent(), enrollment.getCourse());

        return ResponseEntity.ok(EnrollmentEntry.from(enrollment));
    }

    @PutMapping("/course/{courseId}/enrollments/{enrollmentId}/reject")
    @Transactional
    public ResponseEntity<EnrollmentEntry> rejectEnrollment(
            @PathVariable Long courseId,
            @PathVariable Long enrollmentId
    ) {
        verifyInstructorOwnsCourse(courseId);
        CourseEnrollment enrollment = enrollmentRepository.findById(enrollmentId)
                .orElseThrow(() -> new IllegalArgumentException("수강 신청을 찾을 수 없습니다"));
        if (!enrollment.getCourse().getId().equals(courseId)) {
            return ResponseEntity.badRequest().build();
        }
        enrollment.setStatus("REJECTED");
        enrollmentRepository.save(enrollment);
        return ResponseEntity.ok(EnrollmentEntry.from(enrollment));
    }

    private void verifyInstructorOwnsCourse(Long courseId) {
        Long userId = SecurityUtil.getCurrentUserId();
        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new IllegalArgumentException("과정을 찾을 수 없습니다"));
        if (course.getCreatedBy() == null || !course.getCreatedBy().getId().equals(userId)) {
            throw new SecurityException("해당 과정의 담당 강사가 아닙니다");
        }
    }
}
