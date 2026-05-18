import { api } from './client.js';

export interface ProjectResponse {
  id: string;
  name_ct: string;
  name_nonce: string;
  wrapped_pdk_for_user: string;
  wrap_nonce_for_user: string;
  created_at: string;
  updated_at: string;
}

export function listProjects() {
  return api.get<{ projects: ProjectResponse[] }>('/projects');
}

export function getProject(id: string) {
  return api.get<ProjectResponse>(`/projects/${id}`);
}

export function createProject(body: {
  name_ct: string;
  name_nonce: string;
  wrapped_pdk_for_user: string;
  wrap_nonce_for_user: string;
}) {
  return api.post<{ id: string; created_at: string }>('/projects', body);
}

export function deleteProject(id: string) {
  return api.del(`/projects/${id}`);
}

export function rotatePDK(projectId: string, body: {
  wrapped_pdk_for_user: string;
  wrap_nonce_for_user: string;
  name_ct: string;
  name_nonce: string;
  rewrapped_secrets: { secret_id: string; wrapped_item_key: string; wik_nonce: string }[];
}) {
  return api.post<{ ok: boolean }>(`/projects/${projectId}/rotate-pdk`, body);
}
