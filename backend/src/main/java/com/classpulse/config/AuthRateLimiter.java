package com.classpulse.config;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

/**
 * In-memory sliding-window rate limiter for auth endpoints. Keyed by client IP.
 * Not a replacement for Redis/Bucket4j in high-scale deployments, but closes the
 * brute-force hole without introducing new infra.
 *
 * Two buckets enforced per IP:
 *   - 10 attempts / 60s   (short window, catches bursts)
 *   - 50 attempts / 3600s (long window, catches slow-drip bruteforce)
 */
@Component
public class AuthRateLimiter {

    private static final long SHORT_WINDOW_MS = 60_000L;
    private static final int SHORT_MAX = 10;
    private static final long LONG_WINDOW_MS = 3_600_000L;
    private static final int LONG_MAX = 50;

    private final Map<String, AtomicReference<Window>> shortBuckets = new ConcurrentHashMap<>();
    private final Map<String, AtomicReference<Window>> longBuckets = new ConcurrentHashMap<>();

    public boolean tryAcquire(HttpServletRequest request) {
        String ip = extractIp(request);
        long now = System.currentTimeMillis();
        return consume(shortBuckets, ip, now, SHORT_WINDOW_MS, SHORT_MAX)
                && consume(longBuckets, ip, now, LONG_WINDOW_MS, LONG_MAX);
    }

    private boolean consume(Map<String, AtomicReference<Window>> buckets, String key,
                            long now, long windowMs, int max) {
        AtomicReference<Window> ref = buckets.computeIfAbsent(key, k -> new AtomicReference<>(new Window(now, 0)));
        while (true) {
            Window current = ref.get();
            Window next;
            if (now - current.start() >= windowMs) {
                next = new Window(now, 1);
            } else {
                if (current.count() >= max) return false;
                next = new Window(current.start(), current.count() + 1);
            }
            if (ref.compareAndSet(current, next)) return true;
        }
    }

    private String extractIp(HttpServletRequest request) {
        String fwd = request.getHeader("X-Forwarded-For");
        if (fwd != null && !fwd.isBlank()) {
            int comma = fwd.indexOf(',');
            return (comma > 0 ? fwd.substring(0, comma) : fwd).trim();
        }
        return request.getRemoteAddr();
    }

    private record Window(long start, int count) {}
}
