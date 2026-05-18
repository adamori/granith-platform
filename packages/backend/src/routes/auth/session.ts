import type { FastifyInstance } from 'fastify';
import { deleteSession } from '../../services/session.js';
import { logAudit } from '../../services/audit.js';
import { UnauthorizedError } from '../../lib/errors.js';

export async function sessionRoutes(app: FastifyInstance) {
  const db = app.db;
  const config = app.config;

  app.post('/logout', async (request, reply) => {
    const sessionId = request.cookies?.['session'];
    if (sessionId) {
      await deleteSession(db, sessionId);
      if (request.user) {
        await logAudit(db, {
          actor_type: 'user',
          actor_id: request.user.id,
          action: 'logout',
          ip: request.ip,
          user_agent: request.headers['user-agent'],
        });
      }
    }
    reply.clearCookie('session', {
      path: '/',
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    return reply.send({ ok: true });
  });

  app.get('/me', async (request, reply) => {
    if (!request.user) {
      throw new UnauthorizedError();
    }
    return reply.send({ user_id: request.user.id, handle: request.user.handle });
  });
}
