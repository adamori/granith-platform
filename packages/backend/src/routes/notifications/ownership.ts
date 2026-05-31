import type { Kysely } from 'kysely';
import type { Database } from '../../db/types.js';
import { BadRequestError } from '../../lib/errors.js';

// Verify every project id belongs to the user (and is not soft-deleted).
export async function assertOwnsProjects(
  db: Kysely<Database>,
  projectIds: string[],
  userId: string,
): Promise<void> {
  const unique = [...new Set(projectIds)];
  if (unique.length === 0) return;

  const rows = await db
    .selectFrom('projects')
    .where('owner_id', '=', userId)
    .where('deleted_at', 'is', null)
    .where('id', 'in', unique)
    .select('id')
    .execute();

  if (rows.length !== unique.length) {
    throw new BadRequestError('Unknown or unauthorized project in watch list');
  }
}
