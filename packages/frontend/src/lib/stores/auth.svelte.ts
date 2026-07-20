import * as authApi from '../api/auth.js';
import * as opaqueClient from '../crypto/opaque.js';

interface User {
  id: string;
  handle: string;
}

let user = $state<User | null>(null);
let _kek: Uint8Array | null = null;

export function getUser() {
  return user;
}

export function getKek(): Uint8Array | null {
  return _kek;
}

export function isAuthenticated() {
  return user !== null;
}

export async function checkSession(): Promise<boolean> {
  try {
    const me = await authApi.getMe();
    user = { id: me.user_id, handle: me.handle };
    return true;
  } catch {
    user = null;
    return false;
  }
}

export async function register(handle: string, password: string, derivedKek: Uint8Array) {
  const { clientRegistrationState, registrationRequest } = opaqueClient.startRegistration(password);
  const { registrationResponse } = await authApi.registerStart(handle, registrationRequest);

  const { registrationRecord } = opaqueClient.finishRegistration({
    clientRegistrationState,
    registrationResponse,
    password,
  });

  const result = await authApi.registerFinish({
    handle,
    registrationRecord,
    kdf_params: {
      algorithm: 'argon2id',
      time_cost: 3,
      memory_cost: 65536,
      parallelism: 1,
      salt_length: 16,
    },
  });

  user = { id: result.user_id, handle };
  _kek = derivedKek;
}

export async function login(handle: string, password: string, derivedKek: Uint8Array) {
  const { clientLoginState, startLoginRequest } = opaqueClient.startLogin(password);
  const { loginResponse, login_id } = await authApi.loginStart(handle, startLoginRequest);

  const loginResult = opaqueClient.finishLogin({
    clientLoginState,
    loginResponse,
    password,
  });
  if (!loginResult) throw new Error('OPAQUE login failed');
  const { finishLoginRequest } = loginResult;

  const result = await authApi.loginFinish(login_id, finishLoginRequest);

  user = { id: result.user_id, handle };
  _kek = derivedKek;
}

export async function unlock(password: string) {
  if (!user) throw new Error('No session');
  const { deriveKeys } = await import('../crypto/sodium.js');
  const salt = new TextEncoder().encode(user.handle.padEnd(16, '\0')).slice(0, 16);
  const { kek } = deriveKeys(password, salt);
  _kek = kek;
}

export async function logout() {
  await authApi.logout();
  user = null;
  _kek = null;
}
