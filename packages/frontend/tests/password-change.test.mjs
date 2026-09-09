import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { createServer } from 'vite';

const handle = 'password-change-test';
const oldPassword = 'original-password';
const newPassword = 'replacement-password';
const originalFetch = globalThis.fetch;
let server;
let auth;
let projects;
let keys;
let sodium;
let rows;
let finishRequest;

before(async () => {
  server = await createServer({
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    logLevel: 'error',
  });
  const runner = server.environments.ssr.runner;
  auth = await runner.import('/src/lib/stores/auth.svelte.ts');
  projects = await runner.import('/src/lib/stores/projects.svelte.ts');
  keys = await runner.import('/src/lib/crypto/keys.ts');
  sodium = await runner.import('/src/lib/crypto/sodium.ts');
  const { initCrypto } = await runner.import('/src/lib/crypto/init.ts');
  await initCrypto();

  globalThis.fetch = async (input, options = {}) => {
    const path = new URL(input, 'http://localhost').pathname;
    if (path === '/api/auth/me') {
      return Response.json({ user_id: 'test-user', handle });
    }
    if (path === '/api/auth/password/finish') {
      return finishRequest(JSON.parse(options.body));
    }
    if (path === '/api/projects' && options.method === 'POST') {
      const row = {
        ...JSON.parse(options.body),
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        require_approval: false,
      };
      rows.push(row);
      return Response.json(row, { status: 201 });
    }
    if (path === '/api/projects') {
      return Response.json({ projects: rows });
    }
    throw new Error(`Unexpected API request: ${options.method} ${path}`);
  };
});

after(async () => {
  globalThis.fetch = originalFetch;
  await server?.close();
});

beforeEach(async () => {
  rows = [];
  finishRequest = async ({ rewrapped_pdks }) => {
    for (const pdk of rewrapped_pdks) {
      Object.assign(rows.find((row) => row.id === pdk.project_id), {
        wrapped_pdk_for_user: pdk.wrapped_pdk_for_user,
        wrap_nonce_for_user: pdk.wrap_nonce_for_user,
      });
    }
    return Response.json({ ok: true });
  };
  await auth.checkSession();
  await auth.unlock(oldPassword);
  await projects.loadProjects();
});

function deriveKek(password) {
  const salt = new TextEncoder().encode(handle.padEnd(16, '\0')).slice(0, 16);
  return sodium.deriveKeys(password, salt).kek;
}

function passwordPayload(kek) {
  return {
    registrationRecord: 'test-registration-record',
    kdf_params: { algorithm: 'argon2id', time_cost: 3, memory_cost: 65536, parallelism: 1, salt_length: 16 },
    rewrapped_pdks: projects.getProjects().map((project) => {
      const { wrapped, nonce } = keys.wrapPDKForUser(project.pdk, kek);
      return {
        project_id: project.id,
        wrapped_pdk_for_user: sodium.toBase64Standard(wrapped),
        wrap_nonce_for_user: sodium.toBase64Standard(nonce),
      };
    }),
  };
}

function unwrapProject(id, kek) {
  const row = rows.find((project) => project.id === id);
  return keys.unwrapPDKForUser(
    sodium.fromBase64Standard(row.wrapped_pdk_for_user),
    sodium.fromBase64Standard(row.wrap_nonce_for_user),
    kek,
  );
}

test('successful password change uses the new key for existing and new projects', async () => {
  await projects.createProject('existing');
  const oldKek = deriveKek(oldPassword);
  const newKek = deriveKek(newPassword);
  const finish = finishRequest;
  const { promise, resolve } = Promise.withResolvers();
  finishRequest = async (payload) => {
    await promise;
    return finish(payload);
  };

  const changing = auth.finishPasswordChange(passwordPayload(newKek), newKek);
  assert.deepEqual(auth.getKek(), oldKek);
  resolve();
  await changing;
  await projects.loadProjects();
  assert.equal(projects.getProjects()[0].name, 'existing');

  const id = await projects.createProject('created-after-change');
  assert.deepEqual(unwrapProject(id, newKek), projects.getProjectById(id).pdk);
  assert.throws(() => unwrapProject(id, oldKek));

  await auth.unlock(newPassword);
  await projects.loadProjects();
  assert.deepEqual(projects.getProjects().map((project) => project.name).sort(), ['created-after-change', 'existing']);
});

test('failed password change preserves the old key and subsequent project writes', async () => {
  await projects.createProject('existing');
  const oldKek = deriveKek(oldPassword);
  const newKek = deriveKek(newPassword);
  finishRequest = async () => Response.json({ message: 'Password update failed' }, { status: 500 });

  await assert.rejects(auth.finishPasswordChange(passwordPayload(newKek), newKek), /Password update failed/);
  await projects.loadProjects();
  const id = await projects.createProject('created-after-failure');
  assert.deepEqual(unwrapProject(id, oldKek), projects.getProjectById(id).pdk);
  assert.throws(() => unwrapProject(id, newKek));
});

test('a second password change uses the key established by the first', async () => {
  await projects.createProject('existing');
  const newKek = deriveKek(newPassword);
  await auth.finishPasswordChange(passwordPayload(newKek), newKek);
  assert.deepEqual(auth.getKek(), deriveKek(newPassword));

  const latestKek = deriveKek('another-password');
  await auth.finishPasswordChange(passwordPayload(latestKek), latestKek);
  await projects.loadProjects();
  const id = await projects.createProject('created-after-second-change');
  assert.deepEqual(unwrapProject(id, latestKek), projects.getProjectById(id).pdk);
  assert.throws(() => unwrapProject(id, newKek));
});
