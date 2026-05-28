-- Classrooms / cohort layer. Lets a lecturer (any player who creates a classroom
-- becomes its TEACHER) invite students via a short join code and see their
-- aggregated progress. Auth/role enforcement is consistent with the rest of the
-- codebase: trust the playerId passed in the request. A real production deploy
-- would layer JWT/session auth on top.

CREATE TABLE classrooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    owner_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    join_code VARCHAR(10) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_classrooms_owner ON classrooms(owner_player_id);

CREATE TABLE classroom_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'STUDENT', -- STUDENT | TEACHER
    joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (classroom_id, player_id)
);

CREATE INDEX idx_classroom_members_player ON classroom_members(player_id);
CREATE INDEX idx_classroom_members_classroom ON classroom_members(classroom_id);
