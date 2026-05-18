import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { validatorCompiler, serializerCompiler } from 'fastify-type-provider-zod';
import type { Config } from './config.js';
import { createDb } from './db/connection.js';
import { registerCors } from './plugins/cors.js';
import { registerHelmet } from './plugins/helmet.js';
import { registerRateLimit } from './plugins/rate-limit.js';
import { registerErrorHandler } from './plugins/error-handler.js';
import { createSessionAuthHook } from './plugins/auth.js';
import { createAdminAuthHook } from './plugins/admin-auth.js';
import { registerRoutes as registerAuthRegister } from './routes/auth/register.js';
import { loginRoutes } from './routes/auth/login.js';
import { sessionRoutes } from './routes/auth/session.js';
import { projectListRoutes } from './routes/projects/index.js';
import { projectByIdRoutes } from './routes/projects/by-id.js';
import { secretListRoutes } from './routes/secrets/index.js';
import { secretByIdRoutes } from './routes/secrets/by-id.js';
import { tokenListRoutes } from './routes/tokens/index.js';
import { tokenByIdRoutes } from './routes/tokens/by-id.js';
import { bundleRoutes } from './routes/bundle/index.js';
import { auditRoutes } from './routes/audit/index.js';
import { passwordRoutes } from './routes/auth/password.js';
import { rotatePDKRoutes } from './routes/projects/rotate-pdk.js';
import { inviteAdminRoutes } from './routes/admin/invites.js';
import { userAdminRoutes } from './routes/admin/users.js';
import type { Kysely } from 'kysely';
import type { Database } from './db/types.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: Kysely<Database>;
    config: Config;
  }
}

export async function createApp(config: Config) {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      redact: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.body.password',
        'req.body.registrationRecord',
        'req.body.registrationRequest',
        'req.body.startLoginRequest',
        'req.body.finishLoginRequest',
        'req.body.wrapped_pdk',
        'req.body.token_key',
      ],
      transport: config.NODE_ENV === 'development'
        ? { target: 'pino-pretty' }
        : undefined,
    },
    trustProxy: config.TRUST_PROXY || false,
    bodyLimit: config.BODY_LIMIT,
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  const db = createDb(config.DATABASE_URL);
  app.decorate('db', db);
  app.decorate('config', config);

  await app.register(cookie);
  await registerHelmet(app);
  await registerCors(app, config.CORS_ORIGIN);
  await registerRateLimit(app);
  registerErrorHandler(app);

  app.get('/health', async (_request, reply) => {
    return reply.send({ status: 'ok' });
  });

  await app.register(async (apiApp) => {
    // Public auth routes (no session required)
    await apiApp.register(async (authApp) => {
      await authApp.register(registerAuthRegister);
      await authApp.register(loginRoutes);
    }, { prefix: '/auth' });

    // Session-protected routes
    const sessionAuth = createSessionAuthHook(db);
    await apiApp.register(async (protectedApp) => {
      protectedApp.addHook('preHandler', sessionAuth);
      await protectedApp.register(sessionRoutes, { prefix: '/auth' });
      await protectedApp.register(passwordRoutes, { prefix: '/auth' });
      await protectedApp.register(projectListRoutes, { prefix: '/projects' });
      await protectedApp.register(projectByIdRoutes, { prefix: '/projects' });
      await protectedApp.register(secretListRoutes, { prefix: '/projects' });
      await protectedApp.register(secretByIdRoutes, { prefix: '/projects' });
      await protectedApp.register(tokenListRoutes, { prefix: '/projects' });
      await protectedApp.register(rotatePDKRoutes, { prefix: '/projects' });
      await protectedApp.register(tokenByIdRoutes);
      await protectedApp.register(auditRoutes, { prefix: '/projects' });
    });

    // Machine token routes (no session, token-based auth in handler)
    await apiApp.register(bundleRoutes, { prefix: '/v1' });

    // Admin routes
    const adminAuth = createAdminAuthHook(config.ADMIN_KEY);
    await apiApp.register(async (adminApp) => {
      adminApp.addHook('preHandler', adminAuth);
      await adminApp.register(inviteAdminRoutes);
      await adminApp.register(userAdminRoutes);
    }, { prefix: '/admin' });
  }, { prefix: '/api' });

  return app;
}
