-- Up migration
CREATE TABLE notification_services (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id                  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  driver                    text NOT NULL CHECK (driver IN ('telegram', 'pushover')),
  label                     text,
  credential_ct             bytea NOT NULL,
  credential_nonce          bytea NOT NULL,
  watch_all_projects        boolean NOT NULL DEFAULT false,
  triggers                  jsonb NOT NULL DEFAULT '{"bundle_pull": true, "dashboard_read": false}'::jsonb,
  throttle                  jsonb NOT NULL DEFAULT '{"mode": "cooldown", "cooldown_minutes": 15}'::jsonb,
  state                     text NOT NULL DEFAULT 'enabled'
                              CHECK (state IN ('enabled', 'disabled', 'probation', 'permanently_disabled')),
  consecutive_client_errors int NOT NULL DEFAULT 0,
  last_error                text,
  last_error_at             timestamptz,
  last_sent_at              timestamptz,
  disabled_at               timestamptz,
  disabled_until            timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notify_svc_owner ON notification_services(owner_id);
CREATE INDEX idx_notify_svc_disabled_until ON notification_services(disabled_until) WHERE state = 'disabled';

CREATE TABLE notification_service_projects (
  service_id  uuid NOT NULL REFERENCES notification_services(id) ON DELETE CASCADE,
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  PRIMARY KEY (service_id, project_id)
);

CREATE INDEX idx_notify_svc_proj_project ON notification_service_projects(project_id);

-- Down migration
DROP TABLE notification_service_projects;
DROP TABLE notification_services;
