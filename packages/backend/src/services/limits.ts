import { sql, type Kysely } from 'kysely';
import type { Database, UserLimits } from '../db/types.js';
import { LimitExceededError } from '../lib/errors.js';

// Fair-use cap: total encrypted storage per user.
export const DEFAULT_LIMITS: UserLimits = {
  storage_bytes: 1_048_576, // 1 MB
};

export function base64Bytes(value: string | null | undefined): number {
  if (!value) return 0;
  return Buffer.from(value, 'base64').length;
}

export function hexBytes(value: string | null | undefined): number {
  if (!value) return 0;
  return Buffer.from(value, 'hex').length;
}

export async function getEffectiveLimits(
  db: Kysely<Database>,
  userId: string,
): Promise<UserLimits> {
  const row = await db
    .selectFrom('users')
    .where('id', '=', userId)
    .select('limit_overrides')
    .executeTakeFirst();

  const overrides = row?.limit_overrides ?? null;
  return { ...DEFAULT_LIMITS, ...(overrides ?? {}) };
}

// Sums octet_length() over every user-owned bytea column, including soft-deleted
// rows — they still occupy server storage.
export async function getStorageUsed(
  db: Kysely<Database>,
  userId: string,
): Promise<number> {
  const result = await sql<{ total: string | number }>`
    SELECT
      (SELECT COALESCE(SUM(
          octet_length(wrapped_item_key) + octet_length(wik_nonce) +
          octet_length(name_ct) + octet_length(name_nonce) +
          octet_length(value_ct) + octet_length(value_nonce)
        ), 0) FROM secrets WHERE owner_id = ${userId})
    + (SELECT COALESCE(SUM(
          octet_length(name_ct) + octet_length(name_nonce) +
          octet_length(wrapped_pdk_for_user) + octet_length(wrap_nonce_for_user)
        ), 0) FROM projects WHERE owner_id = ${userId})
    + (SELECT COALESCE(SUM(
          octet_length(token_id) + octet_length(wrapped_pdk) + octet_length(wrap_nonce) +
          COALESCE(octet_length(label_ct), 0) + COALESCE(octet_length(label_nonce), 0)
        ), 0) FROM tokens WHERE owner_id = ${userId})
    + (SELECT COALESCE(SUM(
          octet_length(credential_ct) + octet_length(credential_nonce)
        ), 0) FROM notification_services WHERE owner_id = ${userId})
      AS total
  `.execute(db);

  return Number(result.rows[0]?.total ?? 0);
}

// Approximate (no locking): fair-use enforcement, not billing.
export async function assertStorageAvailable(
  db: Kysely<Database>,
  userId: string,
  incomingBytes: number,
): Promise<void> {
  if (incomingBytes <= 0) return;

  const [limits, used] = await Promise.all([
    getEffectiveLimits(db, userId),
    getStorageUsed(db, userId),
  ]);

  if (used + incomingBytes > limits.storage_bytes) {
    throw new LimitExceededError({ used, limit: limits.storage_bytes });
  }
}
