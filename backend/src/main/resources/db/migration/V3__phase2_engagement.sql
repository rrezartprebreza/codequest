CREATE TABLE player_engagement (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL UNIQUE REFERENCES players(id) ON DELETE CASCADE,
    hearts_remaining INTEGER NOT NULL DEFAULT 5,
    max_hearts INTEGER NOT NULL DEFAULT 5,
    last_heart_refill_at TIMESTAMP NOT NULL DEFAULT NOW(),
    daily_goal_target INTEGER NOT NULL DEFAULT 3,
    lessons_completed_today INTEGER NOT NULL DEFAULT 0,
    daily_goal_date DATE NOT NULL DEFAULT CURRENT_DATE,
    daily_goal_reward_claimed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_player_engagement_player_id ON player_engagement(player_id);

