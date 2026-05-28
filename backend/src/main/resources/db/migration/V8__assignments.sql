-- Assignments: a teacher's curated task tied to a classroom. Students must
-- complete `target_count` matching challenges before `due_at`. Progress is
-- derived from learning_attempts (single source of truth — no parallel state).

CREATE TABLE assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    title VARCHAR(160) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    target_topic VARCHAR(80),                -- nullable: any topic allowed if NULL
    target_practice_mode VARCHAR(40),        -- nullable: any mode allowed if NULL
    target_count INTEGER NOT NULL DEFAULT 3,
    due_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assignments_classroom ON assignments(classroom_id);
CREATE INDEX idx_assignments_due ON assignments(due_at);
