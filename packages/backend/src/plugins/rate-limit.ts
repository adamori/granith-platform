import type { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';

export async function registerRateLimit(app: FastifyInstance) {
  await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: 60_000,
    // Bypass all per-IP limits (global and route-level) in the test suite —
    // tests issue many requests from 127.0.0.1 in quick succession.
    allowList: app.config.NODE_ENV === 'test' ? () => true : undefined,
  });
}
