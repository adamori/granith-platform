-- Up migration
ALTER TABLE users ADD COLUMN limit_overrides jsonb;

-- Down migration
ALTER TABLE users DROP COLUMN limit_overrides;
