import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import type { Database, NotificationThrottle, NotificationTriggers } from '../../db/types.js';
import { openCredential } from '../../lib/notify-crypto.js';
import { getDriver } from './registry.js';
import {
  NOTIFY_CLIENT_ERROR_DISABLE_THRESHOLD,
  NOTIFY_AUTO_REENABLE_HOURS,
  NOTIFY_DEFAULT_COOLDOWN_MINUTES,
  NOTIFY_DEFAULT_NEW_SOURCE_WINDOW_MINUTES,
} from '../../lib/constants.js';

export interface DispatchParams {
  projectId: string;
  ownerId: string; // owner of the project (so watch_all_projects services match)
  trigger: keyof NotificationTriggers & string;
  sourceKey: string; // token id hex or client ip — used for new_source_only throttle, never stored
}

// Ephemeral, process-local memory of recently-seen sources per service for the
// new_source_only throttle. Best-effort: resets on restart and is not shared across
// instances. Deliberately not persisted — keeps source identity out of the DB.
const sourceSeen = new Map<string, Map<string, number>>();

function seenRecently(serviceId: string, sourceKey: string, windowMs: number, now: number): boolean {
  let bucket = sourceSeen.get(serviceId);
  if (!bucket) {
    bucket = new Map();
    sourceSeen.set(serviceId, bucket);
  }
  const last = bucket.get(sourceKey);
  const recent = last !== undefined && now - last < windowMs;
  if (!recent) bucket.set(sourceKey, now);
  return recent;
}

function passesThrottle(
  serviceId: string,
  throttle: NotificationThrottle,
  lastSentAt: Date | null,
  sourceKey: string,
  now: number,
): boolean {
  switch (throttle.mode) {
    case 'every':
      return true;
    case 'cooldown': {
      if (!lastSentAt) return true;
      const minutes = throttle.cooldown_minutes ?? NOTIFY_DEFAULT_COOLDOWN_MINUTES;
      return now - lastSentAt.getTime() >= minutes * 60_000;
    }
    case 'new_source_only': {
      const minutes = throttle.new_source_window_minutes ?? NOTIFY_DEFAULT_NEW_SOURCE_WINDOW_MINUTES;
      return !seenRecently(serviceId, sourceKey, minutes * 60_000, now);
    }
    default:
      return true;
  }
}

export async function dispatchNotifications(
  app: FastifyInstance,
  db: Kysely<Database>,
  params: DispatchParams,
): Promise<void> {
  const { projectId, ownerId, trigger, sourceKey } = params;

  const services = await db
    .selectFrom('notification_services as s')
    .leftJoin('notification_service_projects as sp', (join) =>
      join.onRef('sp.service_id', '=', 's.id').on('sp.project_id', '=', projectId),
    )
    .where('s.state', 'in', ['enabled', 'probation'])
    .where((eb) =>
      eb.or([
        eb.and([eb('s.watch_all_projects', '=', true), eb('s.owner_id', '=', ownerId)]),
        eb('sp.service_id', 'is not', null),
      ]),
    )
    .select([
      's.id',
      's.driver',
      's.credential_ct',
      's.credential_nonce',
      's.triggers',
      's.throttle',
      's.state',
      's.consecutive_client_errors',
      's.last_sent_at',
    ])
    .execute();

  if (services.length === 0) return;

  const now = Date.now();
  const message = {
    title: 'Granith: secrets fetched',
    body: `A secrets fetch was triggered (${trigger}) at ${new Date(now).toISOString()}.`,
  };

  await Promise.allSettled(
    services.map(async (s) => {
      const triggers = s.triggers as unknown as NotificationTriggers;
      if (triggers[trigger] !== true) return;

      const throttle = s.throttle as unknown as NotificationThrottle;
      if (!passesThrottle(s.id, throttle, s.last_sent_at, sourceKey, now)) return;

      const driver = getDriver(s.driver);
      if (!driver) {
        app.log.error({ serviceId: s.id, driver: s.driver }, 'notification: unknown driver');
        return;
      }

      let cred: Record<string, string>;
      try {
        cred = JSON.parse(
          openCredential({ ct: s.credential_ct as Buffer, nonce: s.credential_nonce as Buffer }, app.config.NOTIFY_ENCRYPTION_KEY),
        );
      } catch (err) {
        // Server-side decrypt/parse failure (e.g. key mismatch) — our problem, not the user's.
        app.log.error({ serviceId: s.id, err }, 'notification: failed to decrypt credential');
        return;
      }

      const result = await driver.send(cred, message);
      const sentAt = new Date();

      await db
        .insertInto('notification_deliveries')
        .values({
          service_id: s.id,
          project_id: projectId,
          trigger_type: trigger,
          status: result.status,
          error_message: result.message ?? null,
        })
        .execute();

      if (result.status === 'success') {
        await db
          .updateTable('notification_services')
          .set({
            last_sent_at: sentAt,
            consecutive_client_errors: 0,
            last_error: null,
            last_error_at: null,
            updated_at: sentAt as any,
            ...(s.state === 'probation' ? { state: 'enabled' } : {}),
          })
          .where('id', '=', s.id)
          .execute();
        return;
      }

      if (result.status === 'transient_error') {
        // Not the user's fault (network / provider 5xx / 429). Log so operators can
        // react if it's a Granith-side problem. Never counts toward auto-disable.
        app.log.warn({ serviceId: s.id, driver: s.driver, msg: result.message }, 'notification transient failure');
        await db
          .updateTable('notification_services')
          .set({ last_sent_at: sentAt, last_error: result.message ?? null, last_error_at: sentAt, updated_at: sentAt as any })
          .where('id', '=', s.id)
          .execute();
        return;
      }

      // client_error: user's credential/config is wrong. Count toward auto-disable.
      const newCount = s.consecutive_client_errors + 1;
      const update: Record<string, unknown> = {
        last_sent_at: sentAt,
        consecutive_client_errors: newCount,
        last_error: result.message ?? null,
        last_error_at: sentAt,
        updated_at: sentAt,
      };
      if (newCount >= NOTIFY_CLIENT_ERROR_DISABLE_THRESHOLD) {
        if (s.state === 'probation') {
          // Failed the probation trial — disable for good, no further auto re-enable.
          update.state = 'permanently_disabled';
          update.disabled_at = sentAt;
          update.disabled_until = null;
        } else {
          update.state = 'disabled';
          update.disabled_at = sentAt;
          update.disabled_until = new Date(sentAt.getTime() + NOTIFY_AUTO_REENABLE_HOURS * 3_600_000);
        }
      }
      await db.updateTable('notification_services').set(update as any).where('id', '=', s.id).execute();
    }),
  );
}
