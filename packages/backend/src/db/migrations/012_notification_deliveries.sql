-- Up migration
CREATE TABLE notification_deliveries (
  id            bigserial PRIMARY KEY,
  service_id    uuid NOT NULL REFERENCES notification_services(id) ON DELETE CASCADE,
  project_id    uuid REFERENCES projects(id) ON DELETE SET NULL,
  trigger_type  text NOT NULL,
  status        text NOT NULL CHECK (status IN ('success', 'client_error', 'transient_error')),
  error_message text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notify_deliv_service ON notification_deliveries(service_id, created_at DESC);
CREATE INDEX idx_notify_deliv_created ON notification_deliveries(created_at);

-- Down migration
DROP TABLE notification_deliveries;
