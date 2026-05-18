import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { projectIdParam } from '../../schemas/projects.js';
import { logAudit } from '../../services/audit.js';
import { BadRequestError, NotFoundError } from '../../lib/errors.js';

const rotatePDKBody = z.object({
  wrapped_pdk_for_user: z.string(),
  wrap_nonce_for_user: z.string(),
  name_ct: z.string(),
  name_nonce: z.string(),
  rewrapped_secrets: z.array(z.object({
    secret_id: z.string().uuid(),
    wrapped_item_key: z.string(),
    wik_nonce: z.string(),
  })),
});

export async function rotatePDKRoutes(app: FastifyInstance) {
  const f = app.withTypeProvider<ZodTypeProvider>();
  const db = app.db;

  f.post('/:id/rotate-pdk', {
    schema: { params: projectIdParam, body: rotatePDKBody },
  }, async (request, reply) => {
    const user = request.user!;
    const projectId = request.params.id;

    const project = await db
      .selectFrom('projects')
      .where('id', '=', projectId)
      .where('owner_id', '=', user.id)
      .where('deleted_at', 'is', null)
      .select('id')
      .executeTakeFirst();

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    const activeSecrets = await db
      .selectFrom('secrets')
      .where('project_id', '=', projectId)
      .where('deleted_at', 'is', null)
      .select('id')
      .execute();

    const submittedIds = new Set(request.body.rewrapped_secrets.map((s) => s.secret_id));
    const missing = activeSecrets.filter((s) => !submittedIds.has(s.id));
    if (missing.length > 0) {
      throw new BadRequestError(
        `PDK rotation must include all active secrets. Missing ${missing.length} secret(s).`,
      );
    }

    await db.transaction().execute(async (tx) => {
      await tx
        .updateTable('projects')
        .set({
          wrapped_pdk_for_user: Buffer.from(request.body.wrapped_pdk_for_user, 'base64'),
          wrap_nonce_for_user: Buffer.from(request.body.wrap_nonce_for_user, 'base64'),
          name_ct: Buffer.from(request.body.name_ct, 'base64'),
          name_nonce: Buffer.from(request.body.name_nonce, 'base64'),
          updated_at: new Date().toISOString(),
        })
        .where('id', '=', projectId)
        .execute();

      for (const s of request.body.rewrapped_secrets) {
        await tx
          .updateTable('secrets')
          .set({
            wrapped_item_key: Buffer.from(s.wrapped_item_key, 'base64'),
            wik_nonce: Buffer.from(s.wik_nonce, 'base64'),
            updated_at: new Date().toISOString(),
          })
          .where('id', '=', s.secret_id)
          .where('project_id', '=', projectId)
          .execute();
      }

      await tx
        .updateTable('tokens')
        .set({ revoked_at: new Date() })
        .where('project_id', '=', projectId)
        .where('revoked_at', 'is', null)
        .execute();
    });

    await logAudit(db, {
      actor_type: 'user',
      actor_id: user.id,
      project_id: projectId,
      action: 'project.rotate_pdk',
      resource_id: projectId,
      ip: request.ip,
      user_agent: request.headers['user-agent'],
    });

    return reply.send({ ok: true });
  });
}
