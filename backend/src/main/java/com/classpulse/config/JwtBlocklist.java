package com.classpulse.config;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory JWT blocklist. Tokens added here are considered revoked until their
 * natural expiry. Entries past expiry are removed opportunistically to bound memory.
 *
 * Trade-off vs Redis: restarting the app clears the blocklist. For stronger guarantees
 * move to Redis SETEX or a DB-backed table. For the current scale this is fine.
 */
@Component
public class JwtBlocklist {

    private final Map<String, Long> revokedUntil = new ConcurrentHashMap<>();

    /** Marks a token as revoked until {@code expiresAtEpochMs}. */
    public void revoke(String token, long expiresAtEpochMs) {
        if (token == null || token.isBlank()) return;
        cleanup();
        revokedUntil.put(token, expiresAtEpochMs);
    }

    public boolean isRevoked(String token) {
        if (token == null) return false;
        Long exp = revokedUntil.get(token);
        if (exp == null) return false;
        if (exp < System.currentTimeMillis()) {
            revokedUntil.remove(token);
            return false;
        }
        return true;
    }

    private void cleanup() {
        long now = System.currentTimeMillis();
        revokedUntil.entrySet().removeIf(e -> e.getValue() < now);
    }
}
