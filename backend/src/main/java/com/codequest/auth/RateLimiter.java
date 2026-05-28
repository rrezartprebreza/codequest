package com.codequest.auth;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory sliding-window rate limiter keyed by (bucket, identifier).
 *
 * Used on login, register, and /me/set-password to slow credential-stuffing
 * and password-thrashing. The keyspace is intentionally per-identifier (not
 * just per-IP) so one client can't lock another's account out, and per-IP for
 * register since there's no identifier yet.
 *
 * Limitations:
 *   - Single-instance only. Behind a load balancer this would need Redis. Bucket4j-Redis
 *     is the standard upgrade path; the contract here (acquire/throw on cap) won't change.
 *   - No persistence — restart clears the buckets. Acceptable for in-memory.
 *
 * Cap + window are configurable via codequest.ratelimit.login-*.
 */
@Slf4j
@Component
public class RateLimiter {

    @Value("${codequest.ratelimit.login-max-attempts:8}")
    private int maxAttempts;

    @Value("${codequest.ratelimit.login-window-seconds:300}")
    private int windowSeconds;

    private final ConcurrentHashMap<String, Deque<Long>> hits = new ConcurrentHashMap<>();

    /**
     * Records one attempt. Throws {@link TooManyAttemptsException} (HTTP 429)
     * if the caller has exceeded the cap within the window.
     */
    public void hit(String bucket, String identifier) {
        String key = bucket + ":" + (identifier == null ? "" : identifier.toLowerCase());
        long now = System.currentTimeMillis();
        long windowStart = now - (windowSeconds * 1000L);

        Deque<Long> timestamps = hits.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (timestamps) {
            // Evict expired entries from the front.
            while (!timestamps.isEmpty() && timestamps.peekFirst() < windowStart) {
                timestamps.pollFirst();
            }
            if (timestamps.size() >= maxAttempts) {
                long oldest = timestamps.peekFirst();
                long retryAfterSeconds = Math.max(1, (oldest + windowSeconds * 1000L - now) / 1000);
                throw new TooManyAttemptsException(retryAfterSeconds);
            }
            timestamps.addLast(now);
        }
    }

    /** Clears the bucket for one identifier (e.g. on successful login). */
    public void reset(String bucket, String identifier) {
        if (identifier == null) return;
        hits.remove(bucket + ":" + identifier.toLowerCase());
    }

    public static class TooManyAttemptsException extends RuntimeException {
        private final long retryAfterSeconds;
        public TooManyAttemptsException(long retryAfterSeconds) {
            super("Too many attempts. Try again in " + retryAfterSeconds + " seconds.");
            this.retryAfterSeconds = retryAfterSeconds;
        }
        public long retryAfterSeconds() { return retryAfterSeconds; }
    }
}
