-- Up migration
CREATE TABLE tokens (
  token_id      bytea PRIMARY KEY,
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  owner_id      uuid NOT NULL REFERENCES users(id),
  wrapped_pdk   bytea NOT NULL,
  wrap_nonce    bytea NOT NULL,
  scopes        jsonb NOT NULL,
  label_ct      bytea,
  label_nonce   bytea,
  ip_allowlist  inet[],
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  usage_counter int
);

CREATE INDEX idx_tokens_project ON tokens(project_id, revoked_at);
CREATE INDEX idx_tokens_expires ON tokens(expires_at) WHERE revoked_at IS NULL;

-- Down migration
DROP TABLE tokens;
