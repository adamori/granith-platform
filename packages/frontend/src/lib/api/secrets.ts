import { api } from './client.js';

export interface SecretResponse {
  id: string;
  wrapped_item_key: string;
  wik_nonce: string;
  name_ct: string;
  name_nonce: string;
  value_ct: string;
  value_nonce: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export function listSecrets(projectId: string) {
  return api.get<{ secrets: SecretResponse[] }>(`/projects/${projectId}/secrets`);
}

export function createSecret(projectId: string, body: {
  wrapped_item_key: string;
  wik_nonce: string;
  name_ct: string;
  name_nonce: string;
  value_ct: string;
  value_nonce: string;
}) {
  return api.post<{ id: string; version: number; created_at: string }>(
    `/projects/${projectId}/secrets`,
    body,
  );
}

export function updateSecret(projectId: string, secretId: string, body: {
  wrapped_item_key: string;
  wik_nonce: string;
  name_ct: string;
  name_nonce: string;
  value_ct: string;
  value_nonce: string;
}) {
  return api.put<{ id: string; version: number; updated_at: string }>(
    `/projects/${projectId}/secrets/${secretId}`,
    body,
  );
}

export function deleteSecret(projectId: string, secretId: string) {
  return api.del(`/projects/${projectId}/secrets/${secretId}`);
}
