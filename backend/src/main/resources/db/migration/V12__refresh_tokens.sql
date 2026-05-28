-- Refresh tokens with rotation + reuse detection.
--
-- Model:
--   * On login/register we mint an access token (short TTL, 15 min) AND a refresh
--     token (long TTL, 30 days). Refresh is a random 256-bit value.
--   * Only a SHA-256 hash is stored — DB leaks don't yield usable tokens.
--   * Each refresh chain shares a `family_id`. Using a refresh token marks it
--     `used`, mints a new pair within the same family, and returns it.
--   * If a `used` token is presented again, that's a reuse signal (token was
--     leaked or replayed) — we revoke the entire family. The attacker AND the
--     legitimate user both have to re-authenticate. This is the classic
--     "refresh-token rotation with reuse detection" pattern (RFC 6749 §10.4).

CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL UNIQUE,     -- SHA-256 hex of the raw token
    family_id   UUID NOT NULL,
    used        BOOLEAN NOT NULL DEFAULT FALSE,
    revoked     BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at  TIMESTAMP NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_player    ON refresh_tokens(player_id);
CREATE INDEX idx_refresh_tokens_family    ON refresh_tokens(family_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
