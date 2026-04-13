package com.classpulse.api;

import com.classpulse.config.SecurityUtil;
import com.classpulse.domain.attendance.AttendanceRepository;
import com.classpulse.domain.audit.OperatorAuditLog;
import com.classpulse.domain.audit.AuditLogRepository;
import com.classpulse.domain.consultation.ConsultationRepository;
import com.classpulse.domain.course.Course;
import com.classpulse.domain.course.CourseEnrollment;
import com.classpulse.domain.course.CourseEnrollmentRepository;
import com.classpulse.domain.course.CourseRepository;
import com.classpulse.domain.intervention.InterventionLog;
import com.classpulse.domain.intervention.InterventionLogRepository;
import com.classpulse.domain.twin.StudentTwin;
import com.classpulse.domain.twin.StudentTwinRepository;
import com.classpulse.domain.user.User;
import com.classpulse.domain.user.UserRepository;
import com.classpulse.notification.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/operator")
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OperatorPersonnelController {

    private final UserRepository userRepository;
    private final CourseRepository courseRepository;
    private final StudentTwinRepository studentTwinRepository;
    private final InterventionLogRepository interventionLogRepository;
    private final AuditLogRepository auditLogRepository;
    private final ConsultationRepository consultationRepository;
    private final CourseEnrollmentRepository courseEnrollmentRepository;
    private final AttendanceRepository attendanceRepository;
    private final NotificationService notificationService;

    @GetMapping("/instructors")
    public ResponseEntity<List<Map<String, Object>>> getInstructors() {
        List<User> instructors = userRepository.findByRole(User.Role.INSTRUCTOR);
        List<Map<String, Object>> result = instructors.stream().map(i -> {
            List<Course> courses = courseRepository.findByCreatedById(i.getId());
            long studentCount = courses.stream()
                    .mapToLong(c -> courseEnrollmentRepository.findByCourseId(c.getId()).size())
                    .sum();
            long consultationCount = consultationRepository
                    .findByInstructorIdOrderByScheduledAtDesc(i.getId()).size();
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", i.getId());
            m.put("name", i.getName());
            m.put("email", i.getEmail());
            m.put("courseCount", courses.size());
            m.put("studentCount", studentCount);
            m.put("consultationCount", consultationCount);
            return m;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    @GetMapping("/students")
    public ResponseEntity<List<Map<String, Object>>> getStudents() {
        List<User> students = userRepository.findByRole(User.Role.STUDENT);
        List<Map<String, Object>> result = students.stream().map(s -> {
            List<StudentTwin> twins = studentTwinRepository.findByStudentId(s.getId());
            StudentTwin latest = twins.isEmpty() ? null : twins.get(0);

            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", s.getId());
            m.put("name", s.getName());
            m.put("email", s.getEmail());
            m.put("courseId", latest != null ? latest.getCourse().getId() : null);
            m.put("courseTitle", latest != null ? latest.getCourse().getTitle() : "-");
            m.put("overallRisk", latest != null ? latest.getOverallRiskScore() : BigDecimal.ZERO);
            m.put("trend", latest != null && latest.getTrendDirection() != null ? latest.getTrendDirection() : "STABLE");
            long presentCount = attendanceRepository.countPresentByStudentId(s.getId());
            long totalCount = attendanceRepository.countTotalByStudentId(s.getId());
            m.put("attendanceRate", totalCount > 0 ? (double) presentCount / totalCount : 0.0);
            return m;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    @GetMapping("/students/at-risk")
    public ResponseEntity<List<Map<String, Object>>> getAtRiskStudents() {
        List<StudentTwin> allTwins = studentTwinRepository.findAll();
        List<Map<String, Object>> result = allTwins.stream()
                .filter(t -> t.getOverallRiskScore().compareTo(new BigDecimal("70")) > 0)
                .sorted((a, b) -> b.getOverallRiskScore().compareTo(a.getOverallRiskScore()))
                .map(t -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    long totalAbsences = attendanceRepository.findByStudentId(t.getStudent().getId()).stream()
                            .filter(a -> "ABSENT".equals(a.getStatus()))
                            .count();
                    m.put("id", t.getStudent().getId());
                    m.put("name", t.getStudent().getName());
                    m.put("courseId", t.getCourse().getId());
                    m.put("courseTitle", t.getCourse().getTitle());
                    m.put("overallRisk", t.getOverallRiskScore());
                    m.put("trend", t.getTrendDirection() != null ? t.getTrendDirection() : "STABLE");
                    m.put("consecutiveAbsences", totalAbsences);
                    m.put("aiSuggestion", "이 수강생에 대한 1:1 상담 배정을 권장합니다. 숙련도 점수와 동기 점수가 낮아 개입이 필요합니다.");
                    return m;
                })
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    @PostMapping("/interventions")
    @Transactional
    public ResponseEntity<Map<String, Object>> createIntervention(@RequestBody Map<String, Object> body) {
        Long operatorId = SecurityUtil.getCurrentUserId();
        Long studentId = Long.valueOf(body.get("studentId").toString());
        Long courseId = body.get("courseId") != null ? Long.valueOf(body.get("courseId").toString()) : null;

        StudentTwin twin = null;
        if (courseId != null) {
            twin = studentTwinRepository.findByStudentIdAndCourseId(studentId, courseId).orElse(null);
        } else {
            List<StudentTwin> twins = studentTwinRepository.findByStudentId(studentId);
            twin = twins.isEmpty() ? null : twins.get(0);
        }

        Map<String, Object> twinBefore = null;
        if (twin != null) {
            twinBefore = new LinkedHashMap<>();
            twinBefore.put("mastery", twin.getMasteryScore());
            twinBefore.put("execution", twin.getExecutionScore());
            twinBefore.put("motivation", twin.getMotivationScore());
            twinBefore.put("overallRisk", twin.getOverallRiskScore());
        }

        InterventionLog intervention = InterventionLog.builder()
                .studentId(studentId)
                .operatorId(operatorId)
                .courseId(courseId)
                .interventionType((String) body.getOrDefault("interventionType", "CONSULTATION"))
                .description((String) body.getOrDefault("description", ""))
                .aiSuggested(Boolean.TRUE.equals(body.get("aiSuggested")))
                .twinScoreBefore(twinBefore)
                .build();
        interventionLogRepository.save(intervention);
        notifyInstructorForIntervention(studentId, courseId, intervention.getDescription(), operatorId, intervention.getId());

        try {
            OperatorAuditLog auditLog = OperatorAuditLog.builder()
                    .operatorId(operatorId)
                    .actionType("INTERVENTION_CREATE")
                    .targetType("STUDENT")
                    .targetId(studentId)
                    .details(Map.of(
                            "interventionType", body.getOrDefault("interventionType", ""),
                            "aiSuggested", body.getOrDefault("aiSuggested", false)
                    ))
                    .build();
            auditLogRepository.save(auditLog);
        } catch (Exception e) {
            log.error("Failed to write audit log", e);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", intervention.getId());
        result.put("status", intervention.getStatus());
        return ResponseEntity.ok(result);
    }

    @GetMapping("/interventions")
    public ResponseEntity<List<Map<String, Object>>> getInterventions() {
        List<InterventionLog> logs = new ArrayList<>();
        logs.addAll(interventionLogRepository.findByStatusOrderByCreatedAtDesc("PENDING"));
        logs.addAll(interventionLogRepository.findByStatusOrderByCreatedAtDesc("IN_PROGRESS"));
        logs.addAll(interventionLogRepository.findByStatusOrderByCreatedAtDesc("COMPLETED"));

        List<Map<String, Object>> result = logs.stream().map(l -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", l.getId());
            m.put("studentId", l.getStudentId());
            m.put("operatorId", l.getOperatorId());
            m.put("courseId", l.getCourseId());
            m.put("interventionType", l.getInterventionType());
            m.put("description", l.getDescription());
            m.put("aiSuggested", l.getAiSuggested());
            m.put("status", l.getStatus());
            m.put("createdAt", l.getCreatedAt() != null ? l.getCreatedAt().toString() : null);
            return m;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    // ── 2A. Instructor Effectiveness ────────────────────────────────────────

    @GetMapping("/instructors/effectiveness")
    public ResponseEntity<List<Map<String, Object>>> getInstructorEffectiveness() {
        List<User> instructors = userRepository.findByRole(User.Role.INSTRUCTOR);

        List<Map<String, Object>> result = instructors.stream().map(instructor -> {
            List<Course> courses = courseRepository.findByCreatedById(instructor.getId());

            List<StudentTwin> allTwins = courses.stream()
                    .flatMap(c -> studentTwinRepository.findByCourseId(c.getId()).stream())
                    .collect(Collectors.toList());

            int studentCount = allTwins.size();
            int consultationCount = consultationRepository
                    .findByInstructorIdOrderByScheduledAtDesc(instructor.getId()).size();

            double avgMastery = allTwins.stream()
                    .mapToDouble(t -> t.getMasteryScore() != null ? t.getMasteryScore().doubleValue() : 0.0)
                    .average().orElse(0.0);
            double avgMotivation = allTwins.stream()
                    .mapToDouble(t -> t.getMotivationScore() != null ? t.getMotivationScore().doubleValue() : 0.0)
                    .average().orElse(0.0);
            double avgOverallRisk = allTwins.stream()
                    .mapToDouble(t -> t.getOverallRiskScore() != null ? t.getOverallRiskScore().doubleValue() : 0.0)
                    .average().orElse(0.0);
            long atRiskStudentCount = allTwins.stream()
                    .filter(t -> t.getOverallRiskScore() != null &&
                            t.getOverallRiskScore().compareTo(new BigDecimal("70")) > 0)
                    .count();

            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", instructor.getId());
            m.put("name", instructor.getName());
            m.put("courseCount", courses.size());
            m.put("studentCount", studentCount);
            m.put("avgMastery", round2(avgMastery));
            m.put("avgMotivation", round2(avgMotivation));
            m.put("avgOverallRisk", round2(avgOverallRisk));
            m.put("consultationCount", consultationCount);
            m.put("atRiskStudentCount", atRiskStudentCount);
            return m;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    // ── 2B. Instructor Workload ──────────────────────────────────────────────

    @GetMapping("/instructors/workload")
    public ResponseEntity<List<Map<String, Object>>> getInstructorWorkload() {
        List<User> instructors = userRepository.findByRole(User.Role.INSTRUCTOR);

        List<Map<String, Object>> result = instructors.stream().map(instructor -> {
            List<Course> courses = courseRepository.findByCreatedById(instructor.getId());

            int studentCount = courses.stream()
                    .mapToInt(c -> studentTwinRepository.findByCourseId(c.getId()).size())
                    .sum();
            int totalCapacity = courses.stream()
                    .mapToInt(c -> c.getMaxCapacity() != null ? c.getMaxCapacity() : 30)
                    .sum();
            int consultationCount = consultationRepository
                    .findByInstructorIdOrderByScheduledAtDesc(instructor.getId()).size();
            int courseCount = courses.size();

            // Normalize each factor to 0-100 then weighted average
            double studentLoad = totalCapacity > 0 ? Math.min((double) studentCount / totalCapacity, 1.0) * 100 : 0;
            double consultationLoad = Math.min(consultationCount / 20.0, 1.0) * 100;
            double courseLoad = Math.min(courseCount / 5.0, 1.0) * 100;
            double workloadScore = Math.min(studentLoad * 0.5 + consultationLoad * 0.3 + courseLoad * 0.2, 100.0);
            boolean isOverloaded = workloadScore > 70;

            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", instructor.getId());
            m.put("name", instructor.getName());
            m.put("studentCount", studentCount);
            m.put("totalCapacity", totalCapacity);
            m.put("consultationCount", consultationCount);
            m.put("courseCount", courseCount);
            m.put("workloadScore", round2(workloadScore));
            m.put("isOverloaded", isOverloaded);
            return m;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    // ── 2C. Intervention Center (grouped by instructor) ─────────────────────

    @GetMapping("/intervention-center")
    public ResponseEntity<List<Map<String, Object>>> getInterventionCenter() {
        List<StudentTwin> atRiskTwins = studentTwinRepository.findAll().stream()
                .filter(t -> t.getOverallRiskScore() != null &&
                        t.getOverallRiskScore().compareTo(new BigDecimal("70")) > 0)
                .collect(Collectors.toList());

        // Group by course (each course belongs to one instructor)
        Map<Long, List<StudentTwin>> byCourse = atRiskTwins.stream()
                .collect(Collectors.groupingBy(t -> t.getCourse().getId()));

        List<Map<String, Object>> result = byCourse.entrySet().stream().map(entry -> {
            List<StudentTwin> twins = entry.getValue();
            StudentTwin sample = twins.get(0);
            Course course = sample.getCourse();
            User instructor = course.getCreatedBy();

            List<Map<String, Object>> studentList = twins.stream()
                    .sorted((a, b) -> b.getOverallRiskScore().compareTo(a.getOverallRiskScore()))
                    .map(t -> {
                        Map<String, Object> s = new LinkedHashMap<>();
                        s.put("studentId", t.getStudent().getId());
                        s.put("studentName", t.getStudent().getName());
                        s.put("overallRisk", t.getOverallRiskScore());
                        s.put("trend", t.getTrendDirection() != null ? t.getTrendDirection() : "STABLE");
                        return s;
                    }).collect(Collectors.toList());

            int count = twins.size();
            String aiSuggestion = count + "명의 학생에 대한 보충 세션을 권장합니다.";

            Map<String, Object> m = new LinkedHashMap<>();
            m.put("instructorId", instructor != null ? instructor.getId() : null);
            m.put("instructorName", instructor != null ? instructor.getName() : "미지정");
            m.put("courseName", course.getTitle());
            m.put("courseId", course.getId());
            m.put("atRiskStudents", studentList);
            m.put("aiSuggestion", aiSuggestion);
            m.put("studentCount", count);
            return m;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    // ── 2D. Intervention Directive (send notification to instructor) ─────────

    @PostMapping("/intervention-directive")
    @Transactional
    public ResponseEntity<Map<String, Object>> sendInterventionDirective(@RequestBody Map<String, Object> body) {
        Long operatorId = SecurityUtil.getCurrentUserId();
        Long instructorId = Long.valueOf(body.get("instructorId").toString());
        @SuppressWarnings("unchecked")
        List<Integer> rawIds = (List<Integer>) body.get("studentIds");
        List<Long> studentIds = rawIds.stream().map(Long::valueOf).collect(Collectors.toList());
        String directiveType = (String) body.getOrDefault("directiveType", "ATTENTION");
        String message = (String) body.getOrDefault("message", "");

        // Create notification for the instructor
        try {
            notificationService.createNotification(
                    instructorId,
                    "INTERVENTION_DIRECTIVE",
                    "개입 지시",
                    message,
                    Map.of("directiveType", directiveType, "studentIds", studentIds, "operatorId", operatorId)
            );
        } catch (Exception e) {
            log.error("Failed to send notification to instructor {}", instructorId, e);
        }

        // Create InterventionLog for each student
        for (Long studentId : studentIds) {
            InterventionLog log = InterventionLog.builder()
                    .studentId(studentId)
                    .operatorId(operatorId)
                    .interventionType(directiveType)
                    .description(message)
                    .aiSuggested(false)
                    .build();
            interventionLogRepository.save(log);
        }

        // Create AuditLog
        try {
            OperatorAuditLog auditLog = OperatorAuditLog.builder()
                    .operatorId(operatorId)
                    .actionType("INTERVENTION_DIRECTIVE")
                    .targetType("INSTRUCTOR")
                    .targetId(instructorId)
                    .details(Map.of(
                            "directiveType", directiveType,
                            "studentIds", studentIds,
                            "message", message
                    ))
                    .build();
            auditLogRepository.save(auditLog);
        } catch (Exception e) {
            log.error("Failed to write audit log", e);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        result.put("notifiedInstructorId", instructorId);
        result.put("studentCount", studentIds.size());
        return ResponseEntity.ok(result);
    }

    // ── 2E. Intervention Directives History ─────────────────────────────────

    @GetMapping("/intervention-directives")
    public ResponseEntity<List<Map<String, Object>>> getInterventionDirectives() {
        List<InterventionLog> all = interventionLogRepository.findAll();

        List<Map<String, Object>> result = all.stream()
                .filter(l -> Boolean.TRUE.equals(l.getAiSuggested()) ||
                        "ATTENTION".equals(l.getInterventionType()) ||
                        "DIRECTIVE".equals(l.getInterventionType()))
                .sorted(Comparator.comparing(InterventionLog::getCreatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .map(l -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", l.getId());
                    m.put("studentId", l.getStudentId());
                    m.put("operatorId", l.getOperatorId());
                    m.put("courseId", l.getCourseId());
                    m.put("interventionType", l.getInterventionType());
                    m.put("description", l.getDescription());
                    m.put("aiSuggested", l.getAiSuggested());
                    m.put("status", l.getStatus());
                    m.put("createdAt", l.getCreatedAt() != null ? l.getCreatedAt().toString() : null);
                    return m;
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    // ── Helper ───────────────────────────────────────────────────────────────

    private double round2(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }

    private void notifyInstructorForIntervention(Long studentId, Long courseId, String description, Long operatorId, Long interventionId) {
        if (courseId == null) {
            return;
        }

        Course course = courseRepository.findById(courseId).orElse(null);
        if (course == null || course.getCreatedBy() == null) {
            return;
        }

        User student = userRepository.findById(studentId).orElse(null);
        String studentName = student != null ? student.getName() : "학생";
        String message = description == null || description.isBlank()
                ? studentName + " 학생에 대한 운영자 개입이 승인되었습니다."
                : description;

        notificationService.createNotification(
                course.getCreatedBy().getId(),
                "INTERVENTION_DIRECTIVE",
                "운영자 개입 승인",
                message,
                Map.of(
                        "interventionId", interventionId,
                        "studentId", studentId,
                        "studentName", studentName,
                        "courseId", courseId,
                        "operatorId", operatorId
                )
        );
    }
}
