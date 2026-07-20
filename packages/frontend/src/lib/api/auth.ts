import { api } from './client.js';

export function registerStart(handle: string, registrationRequest: string) {
  return api.post<{ registrationResponse: string }>('/auth/register/start', {
    handle,
    registrationRequest,
  });
}

export function registerFinish(params: {
  handle: string;
  registrationRecord: string;
  kdf_params: {
    algorithm: string;
    time_cost: number;
    memory_cost: number;
    parallelism: number;
    salt_length: number;
  };
}) {
  return api.post<{ user_id: string }>('/auth/register/finish', params);
}

export function loginStart(handle: string, startLoginRequest: string) {
  return api.post<{ loginResponse: string; login_id: string }>('/auth/login/start', {
    handle,
    startLoginRequest,
  });
}

export function loginFinish(login_id: string, finishLoginRequest: string) {
  return api.post<{ user_id: string }>('/auth/login/finish', {
    login_id,
    finishLoginRequest,
  });
}

export function getMe() {
  return api.get<{ user_id: string; handle: string }>('/auth/me');
}

export function logout() {
  return api.post('/auth/logout');
}

export function changePasswordStart(registrationRequest: string) {
  return api.post<{ registrationResponse: string }>('/auth/password/start', {
    registrationRequest,
  });
}

export function changePasswordFinish(params: {
  registrationRecord: string;
  kdf_params: {
    algorithm: string;
    time_cost: number;
    memory_cost: number;
    parallelism: number;
    salt_length: number;
  };
  rewrapped_pdks: { project_id: string; wrapped_pdk_for_user: string; wrap_nonce_for_user: string }[];
}) {
  return api.post<{ ok: boolean }>('/auth/password/finish', params);
}
