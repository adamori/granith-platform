-- Up migration
ALTER TABLE users ALTER COLUMN invite_code_used DROP NOT NULL;

-- Down migration
ALTER TABLE users ALTER COLUMN invite_code_used SET NOT NULL;
