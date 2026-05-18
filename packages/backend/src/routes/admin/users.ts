import type { FastifyInstance } from 'fastify';
import { logAudit } from '../../services/audit.js';
import { NotFoundError } from '../../lib/errors.js';

export async function userAdminRoutes(app: FastifyInstance) {
  const db = app.db;

  app.get('/users', async (_request, reply) => {
    const users = await db
      .selectFrom('users')
      .select(['id', 'handle', 'created_at', 'updated_at'])
      .orderBy('created_at', 'desc')
      .execute();

    return reply.send({ users });
  });

  app.delete('/users/:handle', async (request, reply) => {
    const { handle } = request.params as { handle: string };

    const user = await db
      .selectFrom('users')
      .where('handle', '=', handle)
      .select('id')
      .executeTakeFirst();

    if (!user) {
      throw new NotFoundError('User not found');
    }

    await db.deleteFrom('users').where('id', '=', user.id).execute();

    await logAudit(db, {
      actor_type: 'user',
      actor_id: 'admin',
      action: 'user.delete',
      metadata: { handle },
      ip: request.ip,
      user_agent: request.headers['user-agent'],
    });

    return reply.status(204).send();
  });
}
