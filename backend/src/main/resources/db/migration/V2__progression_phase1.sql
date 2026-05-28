CREATE TABLE progression_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(120) NOT NULL,
    topic VARCHAR(120) NOT NULL,
    difficulty VARCHAR(20) NOT NULL,
    xp_reward INTEGER NOT NULL DEFAULT 100,
    order_index INTEGER NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE player_progress_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES progression_nodes(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL,
    completed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_player_node UNIQUE (player_id, node_id)
);

CREATE INDEX idx_player_progress_player ON player_progress_nodes(player_id);
CREATE INDEX idx_player_progress_status ON player_progress_nodes(status);

INSERT INTO progression_nodes (title, topic, difficulty, xp_reward, order_index)
VALUES
    ('Variables and Types', 'variables', 'BEGINNER', 100, 1),
    ('Conditionals and Branching', 'if statements', 'BEGINNER', 120, 2),
    ('Loops and Iteration', 'loops', 'INTERMEDIATE', 150, 3),
    ('Functions and Scope', 'functions', 'INTERMEDIATE', 180, 4),
    ('Collections and Arrays', 'arrays', 'INTERMEDIATE', 200, 5),
    ('Debugging Real Logic Bugs', 'debugging', 'SENIOR', 260, 6);

