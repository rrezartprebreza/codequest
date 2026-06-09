-- Misconception tagging: a short label naming the mental bug the student exhibited
-- (e.g. "off_by_one_inclusive", "missing_null_guard"). Lets the tutor target the
-- mental model, not just the code. Nullable because evaluator may not classify.
CREATE TABLE IF NOT EXISTS learning_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL,
    challenge_id UUID NOT NULL,
    categories VARCHAR(160) NOT NULL,
    bug_pattern VARCHAR(80) NOT NULL,
    verdict VARCHAR(20) NOT NULL,
    hint_level INTEGER NOT NULL,
    attempts_on_challenge INTEGER NOT NULL,
    help_used VARCHAR(160) NOT NULL,
    submission_chars INTEGER NOT NULL,
    duration_sec INTEGER NOT NULL,
    difficulty VARCHAR(20) NOT NULL,
    practice_mode VARCHAR(40) NOT NULL DEFAULT 'BUG_HUNT',
    fingerprint VARCHAR(120) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_attempts_player_created
    ON learning_attempts(player_id, created_at);

CREATE INDEX IF NOT EXISTS idx_learning_attempts_player_challenge
    ON learning_attempts(player_id, challenge_id);

CREATE TABLE IF NOT EXISTS learning_category_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL,
    category VARCHAR(60) NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    correct INTEGER NOT NULL DEFAULT 0,
    partial INTEGER NOT NULL DEFAULT 0,
    wrong INTEGER NOT NULL DEFAULT 0,
    confidence DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    recommended_mode VARCHAR(40) NOT NULL DEFAULT 'BUG_HUNT',
    next_review_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uk_learning_category_player_category UNIQUE (player_id, category)
);

CREATE INDEX IF NOT EXISTS idx_learning_category_player_review
    ON learning_category_stats(player_id, next_review_at);

ALTER TABLE player_challenges
    ADD COLUMN IF NOT EXISTS misconception VARCHAR(80);

ALTER TABLE learning_attempts
    ADD COLUMN IF NOT EXISTS misconception VARCHAR(80);

CREATE INDEX IF NOT EXISTS idx_learning_attempts_misconception
    ON learning_attempts(player_id, misconception)
    WHERE misconception IS NOT NULL;

-- WORKED_EXAMPLE is a new practice_mode value. The columns are already VARCHAR(40)
-- so no schema change is needed — this comment documents the addition for future
-- readers grepping for the mode.
