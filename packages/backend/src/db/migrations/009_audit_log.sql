-- Up migration
CREATE TABLE audit_log (
  id          bigserial PRIMARY KEY,
  actor_type  text NOT NULL CHECK (actor_type IN ('user', 'token')),
  actor_id    text NOT NULL,
  project_id  uuid,
  action      text NOT NULL,
  resource_id uuid,
  ip          inet,
  user_agent  text,
  metadata    jsonb,
  ts          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_project_ts ON audit_log(project_id, ts DESC);
CREATE INDEX idx_audit_actor_ts ON audit_log(actor_id, ts DESC);

-- Down migration
DROP TABLE audit_log;
