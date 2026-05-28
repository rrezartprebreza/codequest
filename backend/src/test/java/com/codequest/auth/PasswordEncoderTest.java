package com.codequest.auth;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Sanity check around the BCrypt configuration we use in {@link SecurityConfig}.
 * Real upgrade would be Argon2; the test pins behaviour so we notice regressions.
 */
class PasswordEncoderTest {

    private final PasswordEncoder encoder = new BCryptPasswordEncoder(10);

    @Test
    void encode_produces_distinct_hashes_for_same_input() {
        String hash1 = encoder.encode("hunter22");
        String hash2 = encoder.encode("hunter22");

        assertThat(hash1).isNotEqualTo(hash2); // salts differ
        assertThat(hash1).startsWith("$2");    // BCrypt prefix
        assertThat(hash1.length()).isLessThanOrEqualTo(72); // fits our column
    }

    @Test
    void matches_returns_true_for_correct_password() {
        String hash = encoder.encode("correct horse battery staple");
        assertThat(encoder.matches("correct horse battery staple", hash)).isTrue();
    }

    @Test
    void matches_returns_false_for_wrong_password() {
        String hash = encoder.encode("hunter22");
        assertThat(encoder.matches("hunter23", hash)).isFalse();
        assertThat(encoder.matches("Hunter22", hash)).isFalse();
    }
}
