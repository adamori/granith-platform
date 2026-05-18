-- Up migration
ALTER TABLE invite_codes DROP CONSTRAINT invite_codes_used_by_fkey;
ALTER TABLE invite_codes ADD CONSTRAINT invite_codes_used_by_fkey
  FOREIGN KEY (used_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE invite_codes DROP CONSTRAINT invite_codes_created_by_fkey;
ALTER TABLE invite_codes ADD CONSTRAINT invite_codes_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- Down migration
ALTER TABLE invite_codes DROP CONSTRAINT invite_codes_used_by_fkey;
ALTER TABLE invite_codes ADD CONSTRAINT invite_codes_used_by_fkey
  FOREIGN KEY (used_by) REFERENCES users(id);

ALTER TABLE invite_codes DROP CONSTRAINT invite_codes_created_by_fkey;
ALTER TABLE invite_codes ADD CONSTRAINT invite_codes_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id);
