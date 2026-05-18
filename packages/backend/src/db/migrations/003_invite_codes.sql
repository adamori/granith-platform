-- Up migration
CREATE TABLE invite_codes (
  code        text PRIMARY KEY,
  created_by  uuid REFERENCES users(id),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  used_by     uuid REFERENCES users(id)
);

-- Down migration
DROP TABLE invite_codes;
