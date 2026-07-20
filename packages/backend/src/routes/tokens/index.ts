import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { createTokenBody } from '../../schemas/tokens.js';
import { projectIdParam } from '../../schemas/projects.js';
import { logAudit } from '../../services/audit.js';
import { assertStorageAvailable, base64Bytes, hexBytes } from '../../services/limits.js';
import { NotFoundError } from '../../lib/errors.js';

export async function tokenListRoutes(app: FastifyInstance) {
  const f = app.withTypeProvider<ZodTypeProvider>();
  const db = app.db;

  f.post('/:id/tokens', {
    schema: { params: projectIdParam, body: createTokenBody },
  }, async (request, reply) => {
    const projectId = request.params.id;

    const project = await db
      .selectFrom('projects')
      .where('id', '=', projectId)
      .where('owner_id', '=', request.user!.id)
      .where('deleted_at', 'is', null)
      .select('id')
      .executeTakeFirst();

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    const { token_id, wrapped_pdk, wrap_nonce, scopes, label_ct, label_nonce, ip_allowlist, expires_at } = request.body;

    const incomingBytes =
      hexBytes(token_id) + base64Bytes(wrapped_pdk) + base64Bytes(wrap_nonce) +
      base64Bytes(label_ct) + base64Bytes(label_nonce);
    await assertStorageAvailable(db, request.user!.id, incomingBytes);

    await db
      .insertInto('tokens')
      .values({
        token_id: Buffer.from(token_id, 'hex'),
        project_id: projectId,
        owner_id: request.user!.id,
        wrapped_pdk: Buffer.from(wrapped_pdk, 'base64'),
        wrap_nonce: Buffer.from(wrap_nonce, 'base64'),
        scopes: JSON.stringify(scopes) as any,
        label_ct: label_ct ? Buffer.from(label_ct, 'base64') : null,
        label_nonce: label_nonce ? Buffer.from(label_nonce, 'base64') : null,
        ip_allowlist: ip_allowlist ?? null,
        expires_at: new Date(expires_at),
      })
      .execute();

    await logAudit(db, {
      actor_type: 'user',
      actor_id: request.user!.id,
      project_id: projectId,
      action: 'token.create',
      ip: request.ip,
      user_agent: request.headers['user-agent'],
    });

    return reply.status(201).send({ ok: true });
  });

  f.get('/:id/tokens', {
    schema: { params: projectIdParam },
  }, async (request, reply) => {
    const projectId = request.params.id;

    const project = await db
      .selectFrom('projects')
      .where('id', '=', projectId)
      .where('owner_id', '=', request.user!.id)
      .where('deleted_at', 'is', null)
      .select('id')
      .executeTakeFirst();

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    const tokens = await db
      .selectFrom('tokens')
      .where('project_id', '=', projectId)
      .select([
        'token_id', 'scopes', 'label_ct', 'label_nonce',
        'ip_allowlist', 'expires_at', 'created_at', 'last_used_at', 'revoked_at', 'usage_counter',
      ])
      .orderBy('created_at', 'desc')
      .execute();

    return reply.send({
      tokens: tokens.map((t) => ({
        token_id: (t.token_id as Buffer).toString('hex'),
        scopes: t.scopes,
        label_ct: t.label_ct ? (t.label_ct as Buffer).toString('base64') : null,
        label_nonce: t.label_nonce ? (t.label_nonce as Buffer).toString('base64') : null,
        ip_allowlist: t.ip_allowlist,
        expires_at: t.expires_at,
        created_at: t.created_at,
        last_used_at: t.last_used_at,
        revoked_at: t.revoked_at,
        usage_counter: t.usage_counter,
      })),
    });
  });
}
