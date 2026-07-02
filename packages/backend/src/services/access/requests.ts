import { randomBytes } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { AccessRequestState, Database } from '../../db/types.js';
import { APPROVAL_REQUEST_TTL_MINUTES } from '../../lib/constants.js';

export interface ActiveRequest {
  id: string;
  state: AccessRequestState;
  expires_at: Date;
  link_nonce: Buffer;
  created: boolean;
}

interface RequesterMeta {
  ip?: string;
  userAgent?: string;
}

// One active (pending/approved) request per token, enforced by the partial unique
// index; ON CONFLICT DO NOTHING + re-select makes concurrent fetches collapse to it.
export async function findOrCreateActiveRequest(
  db: Kysely<Database>,
  token: { token_id: Buffer; project_id: string; owner_id: string },
  requester: RequesterMeta,
): Promise<ActiveRequest> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const inserted = await db
      .insertInto('access_requests')
      .values({
        token_id: token.token_id,
        project_id: token.project_id,
        owner_id: token.owner_id,
        link_nonce: randomBytes(32),
        requester_ip: requester.ip ?? null,
        requester_user_agent: requester.userAgent ?? null,
        expires_at: new Date(Date.now() + APPROVAL_REQUEST_TTL_MINUTES * 60_000),
      })
      .onConflict((oc) => oc.doNothing())
      .returning(['id', 'state', 'expires_at', 'link_nonce'])
      .executeTakeFirst();

    if (inserted) {
      return { ...inserted, link_nonce: inserted.link_nonce as Buffer, created: true };
    }

    const existing = await db
      .selectFrom('access_requests')
      .where('token_id', '=', token.token_id)
      .where('state', 'in', ['pending', 'approved'])
      .select(['id', 'state', 'expires_at', 'link_nonce'])
      .executeTakeFirst();

    if (existing) {
      return { ...existing, link_nonce: existing.link_nonce as Buffer, created: false };
    }
    // active row vanished between insert and select (decided concurrently) — retry
  }
  throw new Error('Could not create access request');
}

// Exactly-once delivery arbiter: only the caller that flips approved -> consumed
// may deliver the bundle.
export async function consumeApprovedRequest(db: Kysely<Database>, requestId: string): Promise<boolean> {
  const result = await db
    .updateTable('access_requests')
    .set({ state: 'consumed', consumed_at: new Date() })
    .where('id', '=', requestId)
    .where('state', '=', 'approved')
    .executeTakeFirst();
  return result.numUpdatedRows === 1n;
}

export async function expirePendingRequest(db: Kysely<Database>, requestId: string): Promise<boolean> {
  const result = await db
    .updateTable('access_requests')
    .set({ state: 'expired', decided_at: new Date() })
    .where('id', '=', requestId)
    .where('state', '=', 'pending')
    .where('expires_at', '<=', new Date())
    .executeTakeFirst();
  return result.numUpdatedRows === 1n;
}
