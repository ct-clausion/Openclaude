package com.classpulse.api;

import com.classpulse.config.SecurityUtil;
import com.classpulse.domain.attendance.AttendanceRepository;
import com.classpulse.domain.attendance.CourseSession;
import com.classpulse.domain.attendance.CourseSessionRepository;
import com.classpulse.domain.consultation.ConsultationRepository;
import com.classpulse.domain.course.Course;
import com.classpulse.domain.course.CourseEnrollmentRepository;
import com.classpulse.domain.course.CourseRepository;
import com.classpulse.domain.twin.StudentTwin;
import com.classpulse.domain.twin.StudentTwinRepository;
import com.classpulse.domain.twin.CourseTwinSnapshot;
import com.classpulse.domain.twin.CourseTwinSnapshotRepository;
import com.classpulse.domain.intervention.InterventionLog;
import com.classpulse.domain.intervention.InterventionLogRepository;
import com.classpulse.domain.user.User;
import com.classpulse.domain.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@org.springframework.security.access.prepost.PreAuthorize("hasRole('OPERATOR')")
@RequestMapping("/api/operator/dashboard")
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OperatorDashboardController {

    private final CourseRepository courseRepository;
    private final UserRepository userRepository;
    private final StudentTwinRepository studentTwinRepository;
    private final CourseTwinSnapshotRepository courseTwinSnapshotRepository;
    private final InterventionLogRepository interventionLogRepository;
    private final ConsultationRepository consultationRepository;
    private final AttendanceRepository attendanceRepository;
    private final CourseSessionRepository courseSessionRepository;
    private final CourseEnrollmentRepository courseEnrollmentRepository;

    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getSummary() {
        List<Course> allCourses = courseRepository.findAll();
        long activeCourses = allCourses.stream().filter(c -> "ACTIVE".equals(c.getStatus())).count();
        long totalStudents = userRepository.findByRole(User.Role.STUDENT).size();
        long totalInstructors = userRepository.findByRole(User.Role.INSTRUCTOR).size();

        List<StudentTwin> allTwins = studentTwinRepository.findAll();
        long atRiskStudents = allTwins.stream()
                .filter(t -> t.getOverallRiskScore().compareTo(new BigDecimal("70")) > 0)
                .map(t -> t.getStudent().getId())
                .distinct()
                .count();

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalCourses", allCourses.size());
        summary.put("activeCourses", activeCourses);
        summary.put("totalStudents", totalStudents);
        summary.put("totalInstructors", totalInstructors);
        summary.put("atRiskStudents", atRiskStudents);

        long pendingConsultations = consultationRepository.findAll().stream()
                .filter(c -> "SCHEDULED".equals(c.getStatus()))
                .count();
        summary.put("pendingConsultations", pendingConsultations);

        List<CourseSession> todaySessions = courseSessionRepository.findBySessionDate(LocalDate.now());
        if (!todaySessions.isEmpty()) {
            long totalPresent = 0, totalRecords = 0;
            for (CourseSession session : todaySessions) {
                totalPresent += attendanceRepository.countBySessionIdAndStatus(session.getId(), "PRESENT");
                totalRecords += attendanceRepository.findBySessionId(session.getId()).size();
            }
            summary.put("todayAttendanceRate", totalRecords > 0 ? (double) totalPresent / totalRecords : 0.0);
        } else {
            summary.put("todayAttendanceRate", 0.0);
        }

        return ResponseEntity.ok(summary);
    }

    @GetMapping("/course-twins")
    public ResponseEntity<List<Map<String, Object>>> getCourseTwins() {
        List<CourseTwinSnapshot> snapshots = courseTwinSnapshotRepository.findBySnapshotDate(LocalDate.now());
        if (snapshots.isEmpty()) {
            List<Course> courses = courseRepository.findByStatus("ACTIVE");
            List<Map<String, Object>> result = new ArrayList<>();
            for (Course course : courses) {
                List<StudentTwin> twins = studentTwinRepository.findByCourseId(course.getId());
                if (twins.isEmpty()) continue;

                double avgMastery = twins.stream().mapToDouble(t -> t.getMasteryScore().doubleValue()).average().orElse(0);
                double avgExecution = twins.stream().mapToDouble(t -> t.getExecutionScore().doubleValue()).average().orElse(0);
                double avgMotivation = twins.stream().mapToDouble(t -> t.getMotivationScore().doubleValue()).average().orElse(0);
                long atRisk = twins.stream().filter(t -> t.getOverallRiskScore().compareTo(new BigDecimal("70")) > 0).count();
                double riskRatio = (double) atRisk / twins.size();
                double healthScore = 0.3 * avgMastery + 0.2 * avgExecution + 0.2 * avgMotivation + 0.15 * (1 - riskRatio) * 100 + 0.15 * 100;

                Map<String, Object> ct = new LinkedHashMap<>();
                ct.put("id", course.getId());
                ct.put("courseId", course.getId());
                ct.put("courseTitle", course.getTitle());
                ct.put("avgMastery", Math.round(avgMastery * 100.0) / 100.0);
                ct.put("avgExecution", Math.round(avgExecution * 100.0) / 100.0);
                ct.put("avgMotivation", Math.round(avgMotivation * 100.0) / 100.0);
                ct.put("retentionRiskRatio", Math.round(riskRatio * 10000.0) / 10000.0);
                ct.put("attendanceRate", 1.0);
                ct.put("completionProjection", 0.0);
                ct.put("healthScore", Math.round(healthScore * 100.0) / 100.0);
                ct.put("studentCount", twins.size());
                ct.put("atRiskCount", atRisk);
                ct.put("snapshotDate", LocalDate.now().toString());
                result.add(ct);
            }
            return ResponseEntity.ok(result);
        }

        List<Map<String, Object>> result = snapshots.stream().map(s -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", s.getId());
            m.put("courseId", s.getCourseId());
            Course course = courseRepository.findById(s.getCourseId()).orElse(null);
            m.put("courseTitle", course != null ? course.getTitle() : "Course #" + s.getCourseId());
            m.put("avgMastery", s.getAvgMastery());
            m.put("avgExecution", s.getAvgExecution());
            m.put("avgMotivation", s.getAvgMotivation());
            m.put("retentionRiskRatio", s.getRetentionRiskRatio());
            m.put("attendanceRate", s.getAttendanceRate());
            m.put("completionProjection", s.getCompletionProjection());
            m.put("healthScore", s.getHealthScore());
            m.put("studentCount", s.getStudentCount());
            m.put("atRiskCount", s.getAtRiskCount());
            m.put("snapshotDate", s.getSnapshotDate().toString());
            return m;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    @GetMapping("/risk-alerts")
    public ResponseEntity<List<Map<String, Object>>> getRiskAlerts() {
        List<StudentTwin> allTwins = studentTwinRepository.findAll();
        List<Map<String, Object>> alerts = allTwins.stream()
                .filter(t -> t.getOverallRiskScore().compareTo(new BigDecimal("60")) > 0)
                .sorted((a, b) -> b.getOverallRiskScore().compareTo(a.getOverallRiskScore()))
                .limit(20)
                .map(t -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("studentId", t.getStudent().getId());
                    m.put("studentName", t.getStudent().getName());
                    m.put("courseTitle", t.getCourse().getTitle());
                    m.put("overallRisk", t.getOverallRiskScore());
                    m.put("trend", t.getTrendDirection() != null ? t.getTrendDirection() : "STABLE");
                    return m;
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(alerts);
    }

    @GetMapping("/attendance-today")
    public ResponseEntity<Map<String, Object>> getAttendanceToday() {
        List<CourseSession> todaySessions = courseSessionRepository.findBySessionDate(LocalDate.now());
        long totalPresent = 0, totalRecords = 0, absentCount = 0;
        for (CourseSession session : todaySessions) {
            long present = attendanceRepository.countBySessionIdAndStatus(session.getId(), "PRESENT");
            long total = attendanceRepository.findBySessionId(session.getId()).size();
            long absent = attendanceRepository.countBySessionIdAndStatus(session.getId(), "ABSENT");
            totalPresent += present;
            totalRecords += total;
            absentCount += absent;
        }
        double avgAttendanceRate = totalRecords > 0 ? (double) totalPresent / totalRecords : 0.0;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalSessions", todaySessions.size());
        result.put("avgAttendanceRate", avgAttendanceRate);
        result.put("absentCount", absentCount);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/pending-actions")
    public ResponseEntity<Map<String, Object>> getPendingActions() {
        List<Course> pendingCourses = courseRepository.findAll().stream()
                .filter(c -> "PENDING".equals(c.getApprovalStatus()))
                .collect(Collectors.toList());
        List<InterventionLog> pendingInterventions = interventionLogRepository.findByStatusOrderByCreatedAtDesc("PENDING");

        Map<String, Object> result = new LinkedHashMap<>();
        long unreadAlerts = studentTwinRepository.findAll().stream()
                .filter(t -> t.getOverallRiskScore().compareTo(new BigDecimal("70")) > 0)
                .count();

        result.put("pendingCourses", pendingCourses.size());
        result.put("pendingInterventions", pendingInterventions.size());
        result.put("unreadAlerts", unreadAlerts);
        return ResponseEntity.ok(result);
    }
}
