-- Persist tutor conversation messages alongside the Redis session.
-- Redis is the hot path (cheap reads for the live tutor); Postgres is the
-- durable record used by the lecturer per-student deep-dive.
--
-- Privacy note: chat content can be sensitive. For an institutional deploy,
-- add a retention policy / per-player opt-in before relying on this table
-- for long-term storage.

CREATE TABLE tutor_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    challenge_id UUID REFERENCES challenges(id) ON DELETE SET NULL,
    session_id VARCHAR(120) NOT NULL,
    role VARCHAR(16) NOT NULL,            -- 'user' | 'assistant'
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tutor_messages_player_challenge
    ON tutor_messages(player_id, challenge_id, created_at);
CREATE INDEX idx_tutor_messages_player_recent
    ON tutor_messages(player_id, created_at DESC);
