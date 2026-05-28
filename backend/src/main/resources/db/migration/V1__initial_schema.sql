CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Players
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    preferred_language VARCHAR(10) NOT NULL DEFAULT 'en',
    programming_language VARCHAR(50) NOT NULL DEFAULT 'Java',
    level VARCHAR(20) NOT NULL DEFAULT 'BEGINNER',
    current_xp INTEGER NOT NULL DEFAULT 0,
    total_xp INTEGER NOT NULL DEFAULT 0,
    current_streak INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    last_active_date DATE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Challenges (AI-generated, cached for reuse)
CREATE TABLE challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic VARCHAR(100) NOT NULL,
    difficulty VARCHAR(20) NOT NULL,
    programming_language VARCHAR(50) NOT NULL,
    buggy_code TEXT NOT NULL,
    correct_code TEXT NOT NULL,
    bug_explanation TEXT NOT NULL,
    xp_reward INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Player challenge attempts
CREATE TABLE player_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    challenge_id UUID NOT NULL REFERENCES challenges(id),
    status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS',
    student_solution TEXT,
    ai_feedback TEXT,
    hints_used INTEGER NOT NULL DEFAULT 0,
    xp_earned INTEGER,
    time_spent_seconds INTEGER,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP
);

CREATE INDEX idx_player_challenges_player_id ON player_challenges(player_id);
CREATE INDEX idx_player_challenges_status ON player_challenges(status);
CREATE INDEX idx_challenges_difficulty_lang ON challenges(difficulty, programming_language);
