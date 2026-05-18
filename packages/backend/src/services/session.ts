import type { Kysely } from 'kysely';
import type { Database } from '../db/types.js';
import { SESSION_TTL_DAYS } from '../lib/constants.js';

export async function createSession(db: Kysely<Database>, userId: string): Promise<string> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const result = await db
    .insertInto('sessions')
    .values({ user_id: userId, expires_at: expiresAt })
    .returning('id')
    .executeTakeFirstOrThrow();
  return result.id;
}

export async function deleteSession(db: Kysely<Database>, sessionId: string): Promise<void> {
  await db.deleteFrom('sessions').where('id', '=', sessionId).execute();
}

export async function deleteExpiredSessions(db: Kysely<Database>): Promise<void> {
  await db.deleteFrom('sessions').where('expires_at', '<', new Date()).execute();
}

export async function deleteAllSessionsExcept(
  db: Kysely<Database>,
  userId: string,
  keepSessionId?: string,
): Promise<void> {
  let query = db.deleteFrom('sessions').where('user_id', '=', userId);
  if (keepSessionId) {
    query = query.where('id', '!=', keepSessionId);
  }
  await query.execute();
}

export async function extendSession(db: Kysely<Database>, sessionId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db
    .updateTable('sessions')
    .set({ expires_at: expiresAt })
    .where('id', '=', sessionId)
    .execute();
}
