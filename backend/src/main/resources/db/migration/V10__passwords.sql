-- Add password support to players. Nullable so existing accounts can keep
-- working until users set a password on next login (handled by the API).
ALTER TABLE players
    ADD COLUMN IF NOT EXISTS password_hash VARCHAR(72);

-- 72 = BCrypt produces 60-char hashes; the extra room is for safety / format
-- changes (e.g. Argon2 migration later).
