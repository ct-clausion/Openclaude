package com.classpulse.api;

import com.classpulse.config.SecurityUtil;
import com.classpulse.domain.course.*;
import com.classpulse.domain.user.User;
import com.classpulse.domain.user.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/courses")
@RequiredArgsConstructor
public class CourseController {

    private final CourseRepository courseRepository;
    private final CourseEnrollmentRepository enrollmentRepository;
    private final UserService userService;

    // --- DTOs ---

    public record CreateCourseRequest(String title, String description, String schedule, String classTime, LocalDate startDate, LocalDate endDate) {}

    public record CourseResponse(
            Long id, String title, String description, String schedule, String classTime,
            LocalDate startDate, LocalDate endDate,
            String status, String approvalStatus, String approvalNote,
            Long createdById, String createdByName,
            List<WeekResponse> weeks, int enrollmentCount
    ) {
        public static CourseResponse from(Course c, int enrollmentCount) {
            List<WeekResponse> weeks = c.getWeeks().stream()
                    .map(w -> new WeekResponse(w.getId(), w.getWeekNo(), w.getTitle(), w.getSummary()))
                    .toList();
            return new CourseResponse(
                    c.getId(), c.getTitle(), c.getDescription(),
                    c.getSchedule(), c.getClassTime(),
                    c.getStartDate(), c.getEndDate(),
                    c.getStatus(),
                    c.getApprovalStatus(),
                    c.getApprovalNote(),
                    c.getCreatedBy() != null ? c.getCreatedBy().getId() : null,
                    c.getCreatedBy() != null ? c.getCreatedBy().getName() : null,
                    weeks, enrollmentCount
            );
        }
    }

    public record WeekResponse(Long id, Integer weekNo, String title, String summary) {}

    public record EnrollResponse(Long enrollmentId, Long courseId, Long studentId, String status) {}

    // --- Endpoints ---

    @PostMapping
    public ResponseEntity<CourseResponse> create(@RequestBody CreateCourseRequest request) {
        Long userId = SecurityUtil.getCurrentUserId();
        User instructor = userService.findById(userId);

        Course course = Course.builder()
                .title(request.title())
                .description(request.description())
                .schedule(request.schedule())
                .classTime(request.classTime())
                .startDate(request.startDate())
                .endDate(request.endDate())
                .createdBy(instructor)
                .status("ACTIVE")
                .approvalStatus("PENDING")
                .build();
        course = courseRepository.save(course);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(CourseResponse.from(course, 0));
    }

    @GetMapping
    public ResponseEntity<List<CourseResponse>> list() {
        Long userId = SecurityUtil.getCurrentUserId();
        User currentUser = userService.findById(userId);

        List<Course> courses;
        if (currentUser.getRole() == User.Role.INSTRUCTOR) {
            courses = courseRepository.findByCreatedByIdAndStatus(userId, "ACTIVE");
        } else {
            courses = courseRepository.findByStatusAndApprovalStatus("ACTIVE", "APPROVED");
        }

        List<CourseResponse> responses = courses.stream()
                .map(c -> {
                    int count = enrollmentRepository.findByCourseIdAndStatus(c.getId(), "ACTIVE").size();
                    return CourseResponse.from(c, count);
                })
                .toList();
        return ResponseEntity.ok(responses);
    }

    @GetMapping("/{id}")
    public ResponseEntity<CourseResponse> getById(@PathVariable Long id) {
        Course course = courseRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Course not found: " + id));
        int count = enrollmentRepository.findByCourseIdAndStatus(id, "ACTIVE").size();
        return ResponseEntity.ok(CourseResponse.from(course, count));
    }

    @GetMapping("/my-enrollments")
    public ResponseEntity<List<EnrollResponse>> myEnrollments() {
        Long userId = SecurityUtil.getCurrentUserId();
        List<CourseEnrollment> enrollments = enrollmentRepository.findByStudentId(userId);
        List<EnrollResponse> result = enrollments.stream()
                .map(e -> new EnrollResponse(e.getId(), e.getCourse().getId(), e.getStudent().getId(), e.getStatus()))
                .toList();
        return ResponseEntity.ok(result);
    }

    @PostMapping("/{id}/enroll")
    @Transactional
    public ResponseEntity<?> enroll(@PathVariable Long id) {
        Long userId = SecurityUtil.getCurrentUserId();

        if (enrollmentRepository.existsByCourseIdAndStudentId(id, userId)) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(java.util.Map.of("message", "이미 수강 신청한 과정입니다."));
        }

        Course course = courseRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Course not found: " + id));

        // Date overlap check with ACTIVE/PENDING enrollments
        if (course.getStartDate() != null && course.getEndDate() != null) {
            List<CourseEnrollment> myEnrollments = enrollmentRepository.findByStudentId(userId);
            for (CourseEnrollment existing : myEnrollments) {
                if (!"ACTIVE".equals(existing.getStatus()) && !"PENDING".equals(existing.getStatus())) continue;
                Course existingCourse = existing.getCourse();
                if (existingCourse.getStartDate() != null && existingCourse.getEndDate() != null) {
                    boolean overlaps = !course.getStartDate().isAfter(existingCourse.getEndDate())
                            && !course.getEndDate().isBefore(existingCourse.getStartDate());
                    if (overlaps) {
                        return ResponseEntity.status(HttpStatus.CONFLICT)
                                .body(java.util.Map.of("message",
                                        "'" + existingCourse.getTitle() + "' 과정과 수강 기간이 겹칩니다."));
                    }
                }
            }
        }

        User student = userService.findById(userId);

        CourseEnrollment enrollment = CourseEnrollment.builder()
                .course(course)
                .student(student)
                .status("PENDING")
                .build();
        try {
            enrollment = enrollmentRepository.save(enrollment);
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(java.util.Map.of("message", "이미 수강 신청한 과정입니다."));
        }

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new EnrollResponse(enrollment.getId(), id, userId, enrollment.getStatus()));
    }
}
