package com.classpulse.ai;

import com.classpulse.domain.twin.StudentTwin;
import com.classpulse.domain.twin.StudentTwinRepository;
import com.classpulse.domain.course.CourseEnrollment;
import com.classpulse.domain.course.CourseEnrollmentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Optional;

/**
 * 일일 배치 추론 스케줄러.
 * 24시간 내 갱신되지 않은 학생-과목 쌍에 대해 추론을 실행합니다.
 *
 * Paginated — loading every enrollment row into memory at 2am was an OOM risk as
 * the platform scales. Dispatching goes through AiJobService which is backed by
 * a thread pool, so we rely on that for concurrency control rather than blocking
 * the scheduler thread with Thread.sleep between submissions.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TwinInferenceScheduler {

    private static final int PAGE_SIZE = 500;

    private final CourseEnrollmentRepository enrollmentRepository;
    private final StudentTwinRepository studentTwinRepository;
    private final AiJobService aiJobService;

    @Scheduled(cron = "0 0 2 * * *") // 매일 새벽 2시
    public void dailyBatchInference() {
        log.info("일일 배치 추론 시작");
        LocalDateTime cutoff = LocalDateTime.now().minusHours(24);

        int scheduled = 0;
        int pageIndex = 0;
        while (true) {
            Page<CourseEnrollment> page = enrollmentRepository.findAll(
                    PageRequest.of(pageIndex, PAGE_SIZE));
            if (page.isEmpty()) break;

            for (CourseEnrollment enrollment : page.getContent()) {
                Long studentId = enrollment.getStudent().getId();
                Long courseId = enrollment.getCourse().getId();

                Optional<StudentTwin> twinOpt = studentTwinRepository
                        .findByStudentIdAndCourseId(studentId, courseId);

                if (twinOpt.isPresent() && twinOpt.get().getUpdatedAt() != null
                        && twinOpt.get().getUpdatedAt().isAfter(cutoff)) {
                    continue;
                }

                // Fire-and-forget — runTwinInference is @Async backed by aiTaskExecutor,
                // which enforces its own concurrency limits (core/max pool + queue).
                aiJobService.runTwinInference(studentId, courseId);
                scheduled++;
            }

            if (!page.hasNext()) break;
            pageIndex++;
        }

        log.info("일일 배치 추론 완료 - {}명 스케줄됨", scheduled);
    }
}
