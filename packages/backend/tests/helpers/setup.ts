import { createApp } from '../../src/app.js';
import type { Config } from '../../src/config.js';
import type { FastifyInstance } from 'fastify';

const TEST_CONFIG: Config = {
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://granith:granith@localhost:5432/granith',
  OPAQUE_SERVER_SETUP: process.env.OPAQUE_SERVER_SETUP ?? 'ueJkJ5r7RNdFj13qGWG9gOWQdF4IsU8ntHMBW3JAQ99nC83kq0n6j2pL1cWsRuuuQm70J1nj_dlnUhuONCDAmW4k4W7NbzlIsCVTJJX-vxZzeKochmQzyShvZnHVVyYKnqMnqvAD1IG68H1-QLRvzgp8Y2qKtaVev-GrTnyI1Ug',
  ADMIN_KEY: 'test-admin-key-that-is-at-least-32-chars-long!',
  SESSION_SECRET: 'test-session-secret-at-least-32-chars-ok',
  NOTIFY_ENCRYPTION_KEY: 'test-notify-encryption-key-at-least-32-chars',
  PUBLIC_API_URL: 'http://localhost:3000',
  PORT: 0,
  HOST: '127.0.0.1',
  LOG_LEVEL: 'error',
  CORS_ORIGIN: 'http://localhost:5173',
  NODE_ENV: 'test',
  TRUST_PROXY: [],
  BODY_LIMIT: 524_288,
};

let app: FastifyInstance;

export function getApp() {
  return app;
}

export function getConfig() {
  return TEST_CONFIG;
}

export async function setupTestApp() {
  app = await createApp(TEST_CONFIG);
  await app.ready();
  return app;
}

export async function teardownTestApp() {
  if (app) {
    await app.close();
  }
}

export async function truncateAll() {
  const db = app.db;
  await db.deleteFrom('audit_log').execute();
  await db.deleteFrom('access_requests').execute();
  await db.deleteFrom('tokens').execute();
  await db.deleteFrom('secrets').execute();
  await db.deleteFrom('projects').execute();
  await db.deleteFrom('opaque_login_state').execute();
  await db.deleteFrom('sessions').execute();
  await db.deleteFrom('invite_codes').execute();
  await db.deleteFrom('users').execute();
}

export async function createInviteCode(code = 'test-invite'): Promise<string> {
  const db = app.db;
  await db
    .insertInto('invite_codes')
    .values({
      code,
      created_by: null,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    })
    .execute();
  return code;
}
