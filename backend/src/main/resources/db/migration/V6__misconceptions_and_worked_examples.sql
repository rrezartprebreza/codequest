-- Misconception tagging: a short label naming the mental bug the student exhibited
-- (e.g. "off_by_one_inclusive", "missing_null_guard"). Lets the tutor target the
-- mental model, not just the code. Nullable because evaluator may not classify.
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
