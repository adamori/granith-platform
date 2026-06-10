-- Up migration
-- Allow login-state rows that are not tied to a real user. login/start now creates
-- a state row for unknown handles too (using a dummy OPAQUE record) so that the
-- response is indistinguishable from a real account, preventing handle enumeration.
ALTER TABLE opaque_login_state ALTER COLUMN user_id DROP NOT NULL;

-- Down migration
-- Purge orphan rows first so the NOT NULL constraint can be re-applied.
DELETE FROM opaque_login_state WHERE user_id IS NULL;
ALTER TABLE opaque_login_state ALTER COLUMN user_id SET NOT NULL;
