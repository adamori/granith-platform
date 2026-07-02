import type { Kysely } from 'kysely';
import type { Database } from '../../db/types.js';
import { ACCESS_REQUEST_RETENTION_DAYS } from '../../lib/constants.js';
import { logAudit } from '../audit.js';

// Auto-deny stale pending requests and void approvals that were never consumed.
// Guarded UPDATE + RETURNING -> exactly-once audit even with concurrent sweepers.
export async function sweepExpireRequests(db: Kysely<Database>): Promise<void> {
  for (const [fromState, reason] of [
    ['pending', 'timeout'],
    ['approved', 'approval_unconsumed'],
  ] as const) {
    const rows = await db
      .updateTable('access_requests')
      .set({ state: 'expired', decided_at: new Date() })
      .where('state', '=', fromState)
      .where('expires_at', '<=', new Date())
      .returning(['id', 'token_id', 'project_id'])
      .execute();

    for (const row of rows) {
      await logAudit(db, {
        actor_type: 'token',
        actor_id: (row.token_id as Buffer).toString('hex'),
        project_id: row.project_id,
        action: 'access.timeout',
        resource_id: row.id,
        metadata: { reason },
      });
    }
  }
}

export async function purgeAccessRequests(db: Kysely<Database>): Promise<void> {
  const cutoff = new Date(Date.now() - ACCESS_REQUEST_RETENTION_DAYS * 86_400_000);
  await db
    .deleteFrom('access_requests')
    .where('state', 'in', ['denied', 'expired', 'consumed'])
    .where('created_at', '<', cutoff)
    .execute();
}
