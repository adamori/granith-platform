import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { tokenIdParam, patchTokenBody } from '../../schemas/tokens.js';
import { logAudit } from '../../services/audit.js';
import { NotFoundError } from '../../lib/errors.js';

export async function tokenByIdRoutes(app: FastifyInstance) {
  const f = app.withTypeProvider<ZodTypeProvider>();
  const db = app.db;

  f.patch('/tokens/:token_id', {
    schema: { params: tokenIdParam, body: patchTokenBody },
  }, async (request, reply) => {
    const tokenIdBuf = Buffer.from(request.params.token_id, 'hex');
    const { label_ct, label_nonce, ip_allowlist } = request.body;

    const updates: Record<string, any> = {};
    if (label_ct !== undefined) updates.label_ct = label_ct ? Buffer.from(label_ct, 'base64') : null;
    if (label_nonce !== undefined) updates.label_nonce = label_nonce ? Buffer.from(label_nonce, 'base64') : null;
    if (ip_allowlist !== undefined) updates.ip_allowlist = ip_allowlist;

    const result = await db
      .updateTable('tokens')
      .set(updates)
      .where('token_id', '=', tokenIdBuf)
      .where('owner_id', '=', request.user!.id)
      .where('revoked_at', 'is', null)
      .returning('project_id')
      .executeTakeFirst();

    if (!result) {
      throw new NotFoundError('Token not found');
    }

    await logAudit(db, {
      actor_type: 'user',
      actor_id: request.user!.id,
      project_id: result.project_id,
      action: 'token.update',
      ip: request.ip,
      user_agent: request.headers['user-agent'],
    });

    return reply.send({ ok: true });
  });

  f.delete('/tokens/:token_id', {
    schema: { params: tokenIdParam },
  }, async (request, reply) => {
    const tokenIdBuf = Buffer.from(request.params.token_id, 'hex');

    const result = await db
      .updateTable('tokens')
      .set({ revoked_at: new Date() })
      .where('token_id', '=', tokenIdBuf)
      .where('owner_id', '=', request.user!.id)
      .where('revoked_at', 'is', null)
      .returning('project_id')
      .executeTakeFirst();

    if (!result) {
      throw new NotFoundError('Token not found');
    }

    await logAudit(db, {
      actor_type: 'user',
      actor_id: request.user!.id,
      project_id: result.project_id,
      action: 'token.revoke',
      ip: request.ip,
      user_agent: request.headers['user-agent'],
    });

    return reply.status(204).send();
  });
}
