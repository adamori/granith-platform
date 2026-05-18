-- Up migration
CREATE TABLE opaque_login_state (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  state       bytea NOT NULL,
  expires_at  timestamptz NOT NULL
);

CREATE INDEX idx_opaque_login_state_expires ON opaque_login_state(expires_at);

-- Down migration
DROP TABLE opaque_login_state;
