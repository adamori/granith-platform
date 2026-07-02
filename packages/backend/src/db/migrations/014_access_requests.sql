-- Up migration
ALTER TABLE projects ADD COLUMN require_approval boolean NOT NULL DEFAULT false;

CREATE TABLE access_requests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id              bytea NOT NULL REFERENCES tokens(token_id) ON DELETE CASCADE,
  project_id            uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  owner_id              uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  state                 text NOT NULL DEFAULT 'pending'
                          CHECK (state IN ('pending', 'approved', 'denied', 'expired', 'consumed')),
  -- 32 random bytes mixed into the Approve/Deny link HMAC. Never sent to the client.
  link_nonce            bytea NOT NULL,
  requester_ip          inet,
  requester_user_agent  text,
  decided_at            timestamptz,
  -- 'telegram_callback' is reserved for a future native-inline-button path; no schema
  -- change needed when it lands.
  decided_via           text CHECK (decided_via IN ('link', 'dashboard', 'telegram_callback')),
  consumed_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  expires_at            timestamptz NOT NULL
);

-- At most one active (pending/approved) request per token. This is the concurrency +
-- idempotency arbiter: polling re-checks the same row, and concurrent fetches with the
-- same token collapse to a single request (INSERT ... ON CONFLICT DO NOTHING).
CREATE UNIQUE INDEX uq_access_requests_active_token
  ON access_requests(token_id) WHERE state IN ('pending', 'approved');

-- Owner dashboard listing ("my pending requests, newest first").
CREATE INDEX idx_access_requests_owner ON access_requests(owner_id, state, created_at DESC);

-- Timeout sweep (scans only pending rows).
CREATE INDEX idx_access_requests_sweep ON access_requests(expires_at) WHERE state = 'pending';

-- Down migration
DROP TABLE access_requests;
ALTER TABLE projects DROP COLUMN require_approval;
