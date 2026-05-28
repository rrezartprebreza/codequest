package com.codequest.player;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

public class PlayerDto {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record RegisterRequest(
            @NotBlank @Size(min = 3, max = 50) String username,
            @NotBlank @Email String email,
            @NotBlank @Size(min = 8, max = 200) String password,
            @NotBlank String programmingLanguage,
            @NotNull PlayerLevel level
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record LoginRequest(
            @NotBlank String identifier,
            /**
             * Optional only for legacy accounts created before V10 (no password set yet).
             * The server returns {@code passwordSet=false} in that case so the client
             * forces a set-password step before continuing.
             */
            String password
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record SetPasswordRequest(
            @NotBlank @Size(min = 8, max = 200) String newPassword
    ) {}

    public record PlayerResponse(
            UUID id,
            String username,
            String email,
            String preferredLanguage,
            String programmingLanguage,
            PlayerLevel level,
            int currentXp,
            int totalXp,
            int currentStreak,
            int longestStreak,
            Instant createdAt
    ) {
        public static PlayerResponse from(Player p) {
            return new PlayerResponse(
                    p.getId(), p.getUsername(), p.getEmail(),
                    p.getPreferredLanguage(),
                    p.getProgrammingLanguage(), p.getLevel(),
                    p.getCurrentXp(), p.getTotalXp(),
                    p.getCurrentStreak(), p.getLongestStreak(),
                    p.getCreatedAt()
            );
        }
    }

    public record UpdatePreferencesRequest(
            String programmingLanguage,
            PlayerLevel level
    ) {}

    /** Toggle whether tutor conversation transcripts are persisted for this player. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record UpdatePrivacyRequest(
            @NotNull Boolean tutorMessagesOptIn
    ) {}

    public record PrivacyResponse(
            boolean tutorMessagesOptIn
    ) {
        public static PrivacyResponse from(Player p) {
            return new PrivacyResponse(p.isTutorMessagesOptIn());
        }
    }

    /**
     * Returned by /players (register), /players/login, and /auth/refresh.
     * {@code passwordSet} is false when a legacy user logs in passwordlessly —
     * the client must call /players/me/set-password before doing anything else.
     *
     * Clients store both tokens. Access token (short TTL) authenticates each
     * request; refresh token (long TTL) is sent to /api/v1/auth/refresh to
     * rotate the pair. {@code accessExpiresAtEpochMs} is convenience metadata
     * — server-side expiry remains the source of truth.
     */
    public record AuthResponse(
            PlayerResponse player,
            String accessToken,
            String refreshToken,
            long accessExpiresAtEpochMs,
            boolean passwordSet
    ) {
        public static AuthResponse of(Player player,
                                      String accessToken,
                                      String refreshToken,
                                      long accessExpiresAtEpochMs) {
            return new AuthResponse(
                    PlayerResponse.from(player),
                    accessToken,
                    refreshToken,
                    accessExpiresAtEpochMs,
                    player.hasPassword()
            );
        }
    }
}
