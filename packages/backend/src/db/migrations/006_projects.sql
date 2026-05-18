-- Up migration
CREATE TABLE projects (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id              uuid NOT NULL REFERENCES users(id),
  name_ct               bytea NOT NULL,
  name_nonce            bytea NOT NULL,
  wrapped_pdk_for_user  bytea NOT NULL,
  wrap_nonce_for_user   bytea NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz
);

CREATE INDEX idx_projects_owner ON projects(owner_id, deleted_at);

-- Down migration
DROP TABLE projects;
