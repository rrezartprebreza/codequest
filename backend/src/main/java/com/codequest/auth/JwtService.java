package com.codequest.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

/**
 * Mints and parses JWTs for the CodeQuest API. Tokens identify the player
 * via the {@code sub} claim (UUID). Long-lived (30 days by default); we
 * deliberately do not implement refresh tokens — trade-off documented for the
 * follow-up "real auth hardening" pass.
 */
@Slf4j
@Component
public class JwtService {

    private static final String CLAIM_USERNAME = "username";

    private final SecretKey signingKey;
    private final Duration accessTtl;

    public JwtService(
            @Value("${codequest.jwt.secret}") String secret,
            @Value("${codequest.jwt.access-ttl-seconds:900}") long accessTtlSeconds
    ) {
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            throw new IllegalStateException(
                    "codequest.jwt.secret must be at least 32 bytes (256 bits). Set JWT_SECRET env var.");
        }
        this.signingKey = Keys.hmacShaKeyFor(keyBytes);
        this.accessTtl = Duration.ofSeconds(accessTtlSeconds);
    }

    public String mint(UUID playerId, String username) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(playerId.toString())
                .claim(CLAIM_USERNAME, username)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(accessTtl)))
                .signWith(signingKey)
                .compact();
    }

    public Duration accessTtl() {
        return accessTtl;
    }

    /** Returns the playerId from a valid token, or null when invalid/expired. */
    public UUID parsePlayerId(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(signingKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            return UUID.fromString(claims.getSubject());
        } catch (JwtException | IllegalArgumentException e) {
            log.debug("Rejected JWT: {}", e.getMessage());
            return null;
        }
    }
}
