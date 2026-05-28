-- Tutor message privacy: per-player opt-in flag controlling whether assistant
-- conversation content is persisted to Postgres at all. Redis (live session)
-- still works regardless — opt-out users just don't get durable transcripts
-- in the lecturer deep-dive.
--
-- Default TRUE preserves existing behaviour (transcripts already exist for
-- everyone since V9). Production institutional deployments should consider
-- defaulting to FALSE and adding an explicit consent flow in onboarding.
ALTER TABLE players
    ADD COLUMN IF NOT EXISTS tutor_messages_opt_in BOOLEAN NOT NULL DEFAULT TRUE;
