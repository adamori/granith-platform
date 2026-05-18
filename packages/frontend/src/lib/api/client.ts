import { env } from '$env/dynamic/public';

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export { ApiError };

const base = env.PUBLIC_API_BASE_URL ?? '';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const opts: RequestInit = {
    method,
    credentials: 'include',
  };
  if (body !== undefined) {
    opts.headers = { 'content-type': 'application/json' };
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${base}/api${path}`, opts);
  if (res.status === 204) return undefined as T;
  const json = await res.json();
  if (!res.ok) {
    throw new ApiError(res.status, json.code ?? 'UNKNOWN', json.message ?? 'Request failed');
  }
  return json as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};
