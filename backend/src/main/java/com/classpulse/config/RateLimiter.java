package com.classpulse.config;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Generic sliding-window rate limiter. Callers pass a unique key (user id, IP, etc.)
 * plus a window label. Two bucket families (short/long) are tracked per label.
 *
 * In-memory by design — single-node correctness only. For multi-node deployments
 * swap the maps for Redis-backed counters.
 */
@Component
public class RateLimiter {

    private final Map<String, AtomicReference<Window>> buckets = new ConcurrentHashMap<>();

    public boolean tryAcquire(String label, String key, long windowMs, int max) {
        String bucketKey = label + "|" + key;
        long now = System.currentTimeMillis();
        AtomicReference<Window> ref = buckets.computeIfAbsent(bucketKey, k -> new AtomicReference<>(new Window(now, 0)));
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

    private record Window(long start, int count) {}
}
