ALTER TABLE study_materials
    ADD COLUMN IF NOT EXISTS course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL;

ALTER TABLE study_topics
    ADD COLUMN IF NOT EXISTS material_id INTEGER REFERENCES study_materials(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS ix_study_materials_course_id
    ON study_materials (course_id);

CREATE INDEX IF NOT EXISTS ix_study_topics_material_id
    ON study_topics (material_id);
