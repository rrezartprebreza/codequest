package com.codequest.auth;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;

/**
 * Mints, rotates, and revokes refresh tokens.
 *
 * Threat model:
 *  - DB compromise must not yield usable refresh tokens → we store only the
 *    SHA-256 hash, not the raw token.
 *  - Stolen refresh token reuse must be detectable → tokens are single-use and
 *    rotation reuses the same {@code family_id}; presenting an already-used
 *    token revokes the whole family.
 *
 * Limitations:
 *  - SHA-256 not BCrypt because refresh is on the hot path; the raw token is
 *    256 bits of entropy so a fast hash is enough to defeat DB-leak replay.
 *  - No device binding — a refresh stolen alongside the access token still works.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtService jwtService;

    @Value("${codequest.jwt.refresh-ttl-seconds}")
    private long refreshTtlSeconds;

    private final SecureRandom random = new SecureRandom();

    public record TokenPair(
            String accessToken,
            String refreshToken,
            long accessExpiresAtEpochMs
    ) {}

    /** Mint a fresh (access, refresh) pair on login/register. New family_id. */
    @Transactional
    public TokenPair mintPair(UUID playerId, String username) {
        return mintPair(playerId, username, UUID.randomUUID());
    }

    /**
     * Rotate: takes the raw refresh token from the client, validates it,
     * marks it used, mints a new pair in the same family. Throws and revokes
     * the whole family if the token has already been used (reuse detection).
     */
    @Transactional
    public TokenPair rotate(String rawRefreshToken, String username) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            throw new AccessDeniedException("Refresh token required.");
        }
        String hash = sha256Hex(rawRefreshToken);
        RefreshToken token = refreshTokenRepository.findByTokenHash(hash)
                .orElseThrow(() -> new AccessDeniedException("Unknown refresh token."));

        if (token.isRevoked()) {
            throw new AccessDeniedException("Refresh token revoked.");
        }
        if (token.isExpired()) {
            refreshTokenRepository.delete(token);
            throw new AccessDeniedException("Refresh token expired.");
        }
        if (token.isUsed()) {
            // CLASSIC REUSE — token already redeemed but presented again.
            // Either the legitimate user accidentally double-submitted, or
            // someone replayed a stolen token. Safer to assume compromise:
            // burn the entire family, force re-login.
            int revoked = refreshTokenRepository.revokeFamily(token.getFamilyId());
            log.warn("Refresh-token reuse detected for player={} family={} — revoked {} tokens",
                    token.getPlayerId(), token.getFamilyId(), revoked);
            throw new AccessDeniedException("Refresh token reuse detected — session revoked.");
        }

        token.markUsed();
        refreshTokenRepository.save(token);
        return mintPair(token.getPlayerId(), username, token.getFamilyId());
    }

    /** Logs out: revokes the entire family for this refresh token. */
    @Transactional
    public void logout(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) return;
        String hash = sha256Hex(rawRefreshToken);
        refreshTokenRepository.findByTokenHash(hash).ifPresent(token ->
                refreshTokenRepository.revokeFamily(token.getFamilyId()));
    }

    /** Lightweight lookup used by refresh endpoint to resolve player identity. */
    @Transactional(readOnly = true)
    public Optional<UUID> peekPlayerId(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            return Optional.empty();
        }
        String hash = sha256Hex(rawRefreshToken);
        return refreshTokenRepository.findByTokenHash(hash).map(RefreshToken::getPlayerId);
    }

    @Transactional
    public int pruneExpiredAndRevoked() {
        return refreshTokenRepository.deleteExpiredOrRevoked(Instant.now());
    }

    // ── internals ───────────────────────────────────────────────────────────

    private TokenPair mintPair(UUID playerId, String username, UUID familyId) {
        String accessToken = jwtService.mint(playerId, username);
        long accessExpiresAtEpochMs = Instant.now().plus(jwtService.accessTtl()).toEpochMilli();
        String rawRefresh = generateRawToken();
        Instant expiresAt = Instant.now().plus(Duration.ofSeconds(refreshTtlSeconds));
        refreshTokenRepository.save(RefreshToken.create(
                playerId, sha256Hex(rawRefresh), familyId, expiresAt));
        return new TokenPair(accessToken, rawRefresh, accessExpiresAtEpochMs);
    }

    private String generateRawToken() {
        byte[] bytes = new byte[32]; // 256 bits
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    static String sha256Hex(String value) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
