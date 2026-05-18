import { api } from './client.js';

export interface TokenResponse {
  token_id: string;
  scopes: { read: boolean; write?: boolean };
  label_ct: string | null;
  label_nonce: string | null;
  ip_allowlist: string[] | null;
  expires_at: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  usage_counter: number | null;
}

export function listTokens(projectId: string) {
  return api.get<{ tokens: TokenResponse[] }>(`/projects/${projectId}/tokens`);
}

export function createToken(projectId: string, body: {
  token_id: string;
  wrapped_pdk: string;
  wrap_nonce: string;
  scopes: { read: boolean; write?: boolean };
  label_ct: string | null;
  label_nonce: string | null;
  ip_allowlist: string[] | null;
  expires_at: string;
}) {
  return api.post<{ ok: boolean }>(`/projects/${projectId}/tokens`, body);
}

export function revokeToken(tokenId: string) {
  return api.del(`/tokens/${tokenId}`);
}

export function patchToken(tokenId: string, body: {
  label_ct?: string | null;
  label_nonce?: string | null;
  ip_allowlist?: string[] | null;
}) {
  return api.patch<{ ok: boolean }>(`/tokens/${tokenId}`, body);
}
