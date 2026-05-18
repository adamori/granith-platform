import type { Kysely } from 'kysely';
import type { Database } from '../db/types.js';

export interface AuditEntry {
  actor_type: 'user' | 'token';
  actor_id: string;
  project_id?: string | null;
  action: string;
  resource_id?: string | null;
  ip?: string | null;
  user_agent?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function logAudit(db: Kysely<Database>, entry: AuditEntry): Promise<void> {
  await db
    .insertInto('audit_log')
    .values({
      actor_type: entry.actor_type,
      actor_id: entry.actor_id,
      project_id: entry.project_id ?? null,
      action: entry.action,
      resource_id: entry.resource_id ?? null,
      ip: entry.ip ?? null,
      user_agent: entry.user_agent ?? null,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) as any : null,
    })
    .execute();
}
