import * as opaque from '@serenity-kit/opaque';

export async function registerClient(params: {
  handle: string;
  password: string;
  serverSetup: string;
  app: any;
}): Promise<{ userId: string; sessionCookie: string }> {
  const { handle, password, serverSetup, app } = params;

  const { clientRegistrationState, registrationRequest } =
    opaque.client.startRegistration({ password });

  const startRes = await app.inject({
    method: 'POST',
    url: '/api/auth/register/start',
    payload: { handle, registrationRequest },
  });
  const { registrationResponse } = startRes.json();

  const { registrationRecord } = opaque.client.finishRegistration({
    clientRegistrationState,
    registrationResponse,
    password,
  });

  const finishRes = await app.inject({
    method: 'POST',
    url: '/api/auth/register/finish',
    payload: {
      handle,
      registrationRecord,
      kdf_params: {
        algorithm: 'argon2id',
        time_cost: 1,
        memory_cost: 65536,
        parallelism: 1,
        salt_length: 16,
      },
    },
  });

  const userId = finishRes.json().user_id;
  const setCookie = finishRes.headers['set-cookie'] as string;
  const sessionCookie = extractSessionCookie(setCookie);
  return { userId, sessionCookie };
}

export async function loginClient(params: {
  handle: string;
  password: string;
  app: any;
}): Promise<{ userId: string; sessionCookie: string }> {
  const { handle, password, app } = params;

  const { clientLoginState, startLoginRequest } =
    opaque.client.startLogin({ password });

  const startRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login/start',
    payload: { handle, startLoginRequest },
  });
  const { loginResponse, login_id } = startRes.json();

  const { finishLoginRequest } = opaque.client.finishLogin({
    clientLoginState,
    loginResponse,
    password,
  });

  const finishRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login/finish',
    payload: { login_id, finishLoginRequest },
  });

  const userId = finishRes.json().user_id;
  const setCookie = finishRes.headers['set-cookie'] as string;
  const sessionCookie = extractSessionCookie(setCookie);
  return { userId, sessionCookie };
}

function extractSessionCookie(setCookieHeader: string | string[]): string {
  const raw = Array.isArray(setCookieHeader) ? setCookieHeader.join('; ') : setCookieHeader;
  const match = raw.match(/session=([^;]+)/);
  if (!match) throw new Error('No session cookie found');
  // The session cookie is signed, so its value is URL-encoded in Set-Cookie. Decode it
  // so that re-injecting via `cookies: { session }` doesn't double-encode the signature.
  return decodeURIComponent(match[1]!);
}
