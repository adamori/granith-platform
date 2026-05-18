-- Up migration
CREATE TABLE secrets (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  owner_id         uuid NOT NULL REFERENCES users(id),
  wrapped_item_key bytea NOT NULL,
  wik_nonce        bytea NOT NULL,
  name_ct          bytea NOT NULL,
  name_nonce       bytea NOT NULL,
  value_ct         bytea NOT NULL,
  value_nonce      bytea NOT NULL,
  version          int NOT NULL DEFAULT 1,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

CREATE INDEX idx_secrets_project ON secrets(project_id, deleted_at);
CREATE INDEX idx_secrets_project_updated ON secrets(project_id, updated_at DESC);

-- Down migration
DROP TABLE secrets;
