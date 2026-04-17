package com.classpulse.ai;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.TimeUnit;

/**
 * Redis 기반 추론 디바운서.
 * 5분 윈도우 내 중복 트리거를 방지하여 API 비용을 절감합니다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TwinInferenceDebouncer {

    private final StringRedisTemplate redisTemplate;
    private final AiJobService aiJobService;

    private static final String KEY_PREFIX = "twin:pending:";
    private static final String READY_PREFIX = "twin:ready:";
    private static final long DEBOUNCE_SECONDS = 300; // 5 minutes

    /**
     * 추론 요청을 디바운스합니다.
     * 5분 내 중복 요청은 무시되고, 5분 후 추론이 실행됩니다.
     */
    public void requestInference(Long studentId, Long courseId, String source) {
        String pendingKey = KEY_PREFIX + studentId + ":" + courseId;
        String readyKey = READY_PREFIX + studentId + ":" + courseId;

        Boolean isNew = redisTemplate.opsForValue()
                .setIfAbsent(pendingKey, source, DEBOUNCE_SECONDS, TimeUnit.SECONDS);

        if (Boolean.TRUE.equals(isNew)) {
            // First trigger in the window — schedule a ready marker for when debounce expires
            redisTemplate.opsForValue().set(readyKey,
                    studentId + ":" + courseId + ":" + source,
                    DEBOUNCE_SECONDS + 10, TimeUnit.SECONDS);
            log.info("추론 디바운스 등록 - studentId={}, courseId={}, source={}", studentId, courseId, source);
        } else {
            log.debug("추론 디바운스 무시 (이미 대기 중) - studentId={}, courseId={}", studentId, courseId);
        }
    }

    /**
     * 매 60초마다 만료된 디바운스 키를 확인하고 추론을 실행합니다.
     */
    @Scheduled(fixedRate = 60000)
    public void processReadyInferences() {
        // SCAN instead of KEYS: KEYS blocks the Redis single-threaded event loop for
        // the duration of the match, which stalls every other client on large databases.
        Set<String> readyKeys = new HashSet<>();
        try (Cursor<String> cursor = redisTemplate.scan(
                ScanOptions.scanOptions().match(READY_PREFIX + "*").count(200).build())) {
            while (cursor.hasNext()) readyKeys.add(cursor.next());
        } catch (Exception e) {
            log.warn("Redis SCAN failed: {}", e.getMessage());
            return;
        }
        if (readyKeys.isEmpty()) return;

        for (String readyKey : readyKeys) {
            String pendingKey = readyKey.replace(READY_PREFIX, KEY_PREFIX);

            // Only process if the debounce window has expired (pending key gone)
            if (Boolean.FALSE.equals(redisTemplate.hasKey(pendingKey))) {
                String value = redisTemplate.opsForValue().get(readyKey);
                redisTemplate.delete(readyKey);

                if (value == null) continue;
                String[] parts = value.split(":");
                if (parts.length < 3) continue;

                try {
                    Long studentId = Long.parseLong(parts[0]);
                    Long courseId = Long.parseLong(parts[1]);
                    String source = parts[2];
                    log.info("디바운스 추론 실행 - studentId={}, courseId={}, source={}", studentId, courseId, source);
                    aiJobService.runTwinInference(studentId, courseId);
                } catch (NumberFormatException e) {
                    log.error("디바운스 키 파싱 실패: {}", value);
                }
            }
        }
    }
}
