package com.classpulse.api;

import com.classpulse.ai.AiJobService;
import com.classpulse.config.CourseAccessGuard;
import com.classpulse.config.SecurityUtil;
import com.classpulse.domain.course.CourseEnrollmentRepository;
import com.classpulse.domain.twin.SkillMasterySnapshot;
import com.classpulse.domain.twin.SkillMasterySnapshotRepository;
import com.classpulse.domain.twin.StudentTwin;
import com.classpulse.domain.twin.TwinService;
import com.classpulse.domain.user.User;
import com.classpulse.domain.user.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/twin")
@RequiredArgsConstructor
public class TwinController {

    private final TwinService twinService;
    private final SkillMasterySnapshotRepository snapshotRepository;
    private final AiJobService aiJobService;
    private final UserService userService;
    private final CourseAccessGuard courseAccessGuard;
    private final CourseEnrollmentRepository courseEnrollmentRepository;

    // --- DTOs ---

    public record TwinResponse(
            Long id, Long studentId, Long courseId,
            BigDecimal masteryScore, BigDecimal executionScore,
            BigDecimal retentionRiskScore, BigDecimal motivationScore,
            BigDecimal consultationNeedScore, BigDecimal overallRiskScore,
            String aiInsight, String trendDirection, String trendExplanation,
            List<String> dataConflicts,
            LocalDateTime updatedAt,
            RadarChartData radarChart
    ) {
        public static TwinResponse from(StudentTwin t) {
            RadarChartData radar = new RadarChartData(
                    t.getMasteryScore(),
                    t.getExecutionScore(),
                    t.getRetentionRiskScore(),
                    t.getMotivationScore(),
                    t.getConsultationNeedScore()
            );
            return new TwinResponse(
                    t.getId(), t.getStudent().getId(), t.getCourse().getId(),
                    t.getMasteryScore(), t.getExecutionScore(),
                    t.getRetentionRiskScore(), t.getMotivationScore(),
                    t.getConsultationNeedScore(), t.getOverallRiskScore(),
                    t.getAiInsight(), t.getTrendDirection(), t.getTrendExplanation(),
                    t.getDataConflictsJson(),
                    t.getUpdatedAt(), radar
            );
        }
    }

    public record RadarChartData(
            BigDecimal mastery,
            BigDecimal execution,
            BigDecimal retentionRisk,
            BigDecimal motivation,
            BigDecimal consultationNeed
    ) {}

    public record SnapshotResponse(
            Long id, Long skillId, String skillName,
            BigDecimal understandingScore, BigDecimal practiceScore,
            BigDecimal confidenceScore, BigDecimal forgettingRiskScore,
            String sourceType, LocalDateTime capturedAt
    ) {
        public static SnapshotResponse from(SkillMasterySnapshot s) {
            return new SnapshotResponse(
                    s.getId(),
                    s.getSkill().getId(),
                    s.getSkill().getName(),
                    s.getUnderstandingScore(),
                    s.getPracticeScore(),
                    s.getConfidenceScore(),
                    s.getForgettingRiskScore(),
                    s.getSourceType(),
                    s.getCapturedAt()
            );
        }
    }

    // --- Endpoints ---

    @GetMapping("/{studentId}")
    public ResponseEntity<List<TwinResponse>> getTwin(
            @PathVariable Long studentId,
            @RequestParam(required = false) Long courseId) {
        verifyAccessToStudent(studentId, courseId);
        List<StudentTwin> twins = twinService.getStudentTwins(studentId);
        if (courseId != null) {
            twins = twins.stream().filter(t -> t.getCourse().getId().equals(courseId)).toList();
        }
        return ResponseEntity.ok(twins.stream().map(TwinResponse::from).toList());
    }

    @PostMapping("/{studentId}/courses/{courseId}/refresh")
    public ResponseEntity<Map<String, String>> refreshTwin(
            @PathVariable Long studentId, @PathVariable Long courseId) {
        verifyAccessToStudent(studentId, courseId);
        aiJobService.runTwinInference(studentId, courseId, "INSTRUCTOR_MANUAL");
        return ResponseEntity.ok(Map.of("status", "PROCESSING",
                "message", "트윈 추론이 시작되었습니다."));
    }

    @GetMapping("/{studentId}/history")
    public ResponseEntity<List<SnapshotResponse>> getHistory(
            @PathVariable Long studentId,
            @RequestParam(required = false) Long courseId
    ) {
        verifyAccessToStudent(studentId, courseId);
        List<SkillMasterySnapshot> snapshots;
        if (courseId != null) {
            snapshots = snapshotRepository.findByStudentIdAndCourseIdOrderByCapturedAtDesc(studentId, courseId);
        } else {
            snapshots = snapshotRepository.findTop10ByStudentIdOrderByCapturedAtDesc(studentId);
        }
        return ResponseEntity.ok(snapshots.stream().map(SnapshotResponse::from).toList());
    }

    /**
     * Access:
     *  - A student can read their own twin data.
     *  - An instructor must supply a courseId they own, and the student must be enrolled in it.
     *  - Operators (role == OPERATOR) can read any twin (for dashboards).
     */
    private void verifyAccessToStudent(Long studentId, Long courseId) {
        Long userId = SecurityUtil.getCurrentUserId();
        if (userId.equals(studentId)) return;

        User currentUser = userService.findById(userId);
        if (currentUser.getRole() == User.Role.OPERATOR) return;
        if (currentUser.getRole() != User.Role.INSTRUCTOR) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
        if (courseId == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Instructors must specify a courseId they own");
        }
        courseAccessGuard.assertInstructorOwns(courseId, userId);
        if (!courseEnrollmentRepository.existsByCourseIdAndStudentId(courseId, studentId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Student is not enrolled in this course");
        }
    }
}
