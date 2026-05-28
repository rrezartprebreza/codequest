package com.codequest.auth;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RateLimiterTest {

    private RateLimiter limiter;

    @BeforeEach
    void setUp() {
        limiter = new RateLimiter();
        ReflectionTestUtils.setField(limiter, "maxAttempts", 3);
        ReflectionTestUtils.setField(limiter, "windowSeconds", 60);
    }

    @Test
    void allows_up_to_max_attempts() {
        limiter.hit("login", "alice");
        limiter.hit("login", "alice");
        limiter.hit("login", "alice");
    }

    @Test
    void throws_after_exceeding_cap() {
        limiter.hit("login", "alice");
        limiter.hit("login", "alice");
        limiter.hit("login", "alice");

        assertThatThrownBy(() -> limiter.hit("login", "alice"))
                .isInstanceOf(RateLimiter.TooManyAttemptsException.class);
    }

    @Test
    void buckets_are_per_identifier() {
        limiter.hit("login", "alice");
        limiter.hit("login", "alice");
        limiter.hit("login", "alice");

        // bob is unaffected
        limiter.hit("login", "bob");
        limiter.hit("login", "bob");
        limiter.hit("login", "bob");
    }

    @Test
    void buckets_are_per_bucket_name() {
        limiter.hit("login", "alice");
        limiter.hit("login", "alice");
        limiter.hit("login", "alice");

        // different bucket for the same identifier
        limiter.hit("register", "alice");
    }

    @Test
    void reset_clears_the_bucket() {
        limiter.hit("login", "alice");
        limiter.hit("login", "alice");
        limiter.hit("login", "alice");

        limiter.reset("login", "alice");

        // Should be able to hit again without throwing.
        limiter.hit("login", "alice");
    }

    @Test
    void identifier_match_is_case_insensitive() {
        limiter.hit("login", "Alice");
        limiter.hit("login", "ALICE");
        limiter.hit("login", "alice");

        assertThatThrownBy(() -> limiter.hit("login", "alice"))
                .isInstanceOf(RateLimiter.TooManyAttemptsException.class);
    }

    @Test
    void exception_carries_retry_after_seconds() {
        limiter.hit("login", "alice");
        limiter.hit("login", "alice");
        limiter.hit("login", "alice");

        try {
            limiter.hit("login", "alice");
        } catch (RateLimiter.TooManyAttemptsException ex) {
            assertThat(ex.retryAfterSeconds()).isGreaterThan(0);
            return;
        }
        org.junit.jupiter.api.Assertions.fail("Expected TooManyAttemptsException");
    }
}
