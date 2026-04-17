package com.classpulse.config;

import com.classpulse.domain.course.Course;
import com.classpulse.domain.course.CourseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * Centralizes course-scoped authorization. Any write path that takes a courseId must
 * confirm the caller is the course's owning instructor before mutating data.
 */
@Component
@RequiredArgsConstructor
public class CourseAccessGuard {

    private final CourseRepository courseRepository;

    /** Loads the course or throws 404. */
    public Course loadOrNotFound(Long courseId) {
        return courseRepository.findById(courseId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Course not found"));
    }

    /** Loads and asserts the given user is the course's owning instructor. Throws 403 otherwise. */
    public Course assertInstructorOwns(Long courseId, Long userId) {
        Course course = loadOrNotFound(courseId);
        Long ownerId = course.getCreatedBy() != null ? course.getCreatedBy().getId() : null;
        if (ownerId == null || !ownerId.equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not the owning instructor of this course");
        }
        return course;
    }
}
