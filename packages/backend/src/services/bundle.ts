import { createHash } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { Database } from '../db/types.js';

export interface BundlePayload {
  project: {
    id: string;
    name_ct: string;
    name_nonce: string;
  };
  wrapped_pdk: string;
  wrap_nonce: string;
  secrets: Array<{
    id: string;
    wrapped_item_key: string;
    wik_nonce: string;
    name_ct: string;
    name_nonce: string;
    value_ct: string;
    value_nonce: string;
    version: number;
  }>;
}

export async function assembleBundle(
  db: Kysely<Database>,
  projectId: string,
  tokenWrappedPdk: Buffer,
  tokenWrapNonce: Buffer,
): Promise<{ bundle: BundlePayload; etag: string }> {
  const project = await db
    .selectFrom('projects')
    .where('id', '=', projectId)
    .where('deleted_at', 'is', null)
    .select(['id', 'name_ct', 'name_nonce'])
    .executeTakeFirstOrThrow();

  const secrets = await db
    .selectFrom('secrets')
    .where('project_id', '=', projectId)
    .where('deleted_at', 'is', null)
    .select([
      'id', 'wrapped_item_key', 'wik_nonce',
      'name_ct', 'name_nonce', 'value_ct', 'value_nonce', 'version',
    ])
    .orderBy('updated_at', 'desc')
    .execute();

  const bundle: BundlePayload = {
    project: {
      id: project.id,
      name_ct: (project.name_ct as Buffer).toString('base64'),
      name_nonce: (project.name_nonce as Buffer).toString('base64'),
    },
    wrapped_pdk: tokenWrappedPdk.toString('base64'),
    wrap_nonce: tokenWrapNonce.toString('base64'),
    secrets: secrets.map((s) => ({
      id: s.id,
      wrapped_item_key: (s.wrapped_item_key as Buffer).toString('base64'),
      wik_nonce: (s.wik_nonce as Buffer).toString('base64'),
      name_ct: (s.name_ct as Buffer).toString('base64'),
      name_nonce: (s.name_nonce as Buffer).toString('base64'),
      value_ct: (s.value_ct as Buffer).toString('base64'),
      value_nonce: (s.value_nonce as Buffer).toString('base64'),
      version: s.version,
    })),
  };

  const etag = createHash('sha256')
    .update(JSON.stringify(bundle))
    .digest('hex')
    .slice(0, 32);

  return { bundle, etag };
}
