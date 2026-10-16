-- Align existing tables with the active SQLAlchemy models.
-- All changes are additive and safe to run more than once.

ALTER TABLE study_materials
    ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;

ALTER TABLE quiz_attempts
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE study_topics
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS ix_study_materials_search_vector
    ON study_materials USING gin (search_vector);

UPDATE study_materials
SET search_vector =
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(subject, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'C')
WHERE search_vector IS NULL;
