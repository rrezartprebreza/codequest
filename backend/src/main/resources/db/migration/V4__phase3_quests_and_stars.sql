ALTER TABLE player_progress_nodes
    ADD COLUMN IF NOT EXISTS stars_earned INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS player_quest_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    quest_date DATE NOT NULL,
    quest_type VARCHAR(40) NOT NULL,
    reward_xp INTEGER NOT NULL,
    claimed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_player_quest_claim UNIQUE (player_id, quest_date, quest_type)
);

CREATE INDEX IF NOT EXISTS idx_player_quest_claims_player_date
    ON player_quest_claims(player_id, quest_date);
