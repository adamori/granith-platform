import type { Kysely } from 'kysely';
import type { Database } from '../../db/types.js';
import { NOTIFY_DELIVERY_RETENTION_DAYS } from '../../lib/constants.js';

// Move auto-disabled services into a probation trial once their cool-off has passed.
// The next dispatch attempt decides their fate: success -> enabled, client error -> permanently_disabled.
export async function sweepReenable(db: Kysely<Database>): Promise<void> {
  await db
    .updateTable('notification_services')
    .set({ state: 'probation', consecutive_client_errors: 0, disabled_until: null })
    .where('state', '=', 'disabled')
    .where('disabled_until', '<=', new Date())
    .execute();
}

// Purge delivery log rows past the retention window.
export async function purgeDeliveries(db: Kysely<Database>): Promise<void> {
  const cutoff = new Date(Date.now() - NOTIFY_DELIVERY_RETENTION_DAYS * 86_400_000);
  await db.deleteFrom('notification_deliveries').where('created_at', '<', cutoff).execute();
}
