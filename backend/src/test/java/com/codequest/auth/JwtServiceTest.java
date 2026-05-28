package com.codequest.auth;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class JwtServiceTest {

    private static final String SECRET = "test-secret-test-secret-test-secret-test-secret"; // 48 chars, > 32 bytes
    private static final String OTHER_SECRET = "WRONG-secret-WRONG-secret-WRONG-secret-WRONG-secret";

    @Test
    void mint_and_parse_roundtrips_player_id() {
        JwtService jwt = new JwtService(SECRET, 60);
        UUID playerId = UUID.randomUUID();

        String token = jwt.mint(playerId, "rrezart");
        UUID parsed = jwt.parsePlayerId(token);

        assertThat(parsed).isEqualTo(playerId);
    }

    @Test
    void parse_returns_null_for_token_signed_with_different_key() {
        JwtService jwt = new JwtService(SECRET, 60);
        SecretKey wrongKey = Keys.hmacShaKeyFor(OTHER_SECRET.getBytes(StandardCharsets.UTF_8));
        String foreignToken = Jwts.builder()
                .subject(UUID.randomUUID().toString())
                .issuedAt(new Date())
                .expiration(Date.from(Instant.now().plus(Duration.ofMinutes(5))))
                .signWith(wrongKey)
                .compact();

        assertThat(jwt.parsePlayerId(foreignToken)).isNull();
    }

    @Test
    void parse_returns_null_for_expired_token() {
        JwtService jwt = new JwtService(SECRET, 60);
        SecretKey key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
        String expired = Jwts.builder()
                .subject(UUID.randomUUID().toString())
                .issuedAt(Date.from(Instant.now().minus(Duration.ofMinutes(10))))
                .expiration(Date.from(Instant.now().minus(Duration.ofMinutes(5))))
                .signWith(key)
                .compact();

        assertThat(jwt.parsePlayerId(expired)).isNull();
    }

    @Test
    void parse_returns_null_for_garbage() {
        JwtService jwt = new JwtService(SECRET, 60);
        assertThat(jwt.parsePlayerId("not.a.jwt")).isNull();
        assertThat(jwt.parsePlayerId(null)).isNull();
        assertThat(jwt.parsePlayerId("")).isNull();
    }

    @Test
    void constructor_rejects_short_secret() {
        org.junit.jupiter.api.Assertions.assertThrows(
                IllegalStateException.class,
                () -> new JwtService("too-short", 60)
        );
    }
}
