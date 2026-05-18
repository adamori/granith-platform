-- Up migration
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handle        citext UNIQUE NOT NULL,
  kdf_params    jsonb NOT NULL,
  opaque_record bytea NOT NULL,
  invite_code_used text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Down migration
DROP TABLE users;
