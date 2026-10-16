-- Run this once against the PostgreSQL database used by the backend.
-- Existing users are preserved; new registrations must provide faculty and level.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS faculty VARCHAR(255),
    ADD COLUMN IF NOT EXISTS level INTEGER;

-- Optional backfill for existing users. Replace the values before running if needed.
-- UPDATE users
-- SET faculty = 'Unknown'
-- WHERE faculty IS NULL;
