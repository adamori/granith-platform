import { api } from './client.js';

export type AccessRequestState = 'pending' | 'approved' | 'denied' | 'expired' | 'consumed';

export interface AccessRequestResponse {
  id: string;
  project_id: string;
  token_id: string;
  state: AccessRequestState;
  requester_ip: string | null;
  requester_user_agent: string | null;
  created_at: string;
  expires_at: string;
  decided_at: string | null;
  decided_via: 'link' | 'dashboard' | 'telegram_callback' | null;
  consumed_at: string | null;
}

export function listAccessRequests(params: { state?: AccessRequestState; project_id?: string; limit?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.state) qs.set('state', params.state);
  if (params.project_id) qs.set('project_id', params.project_id);
  if (params.limit) qs.set('limit', String(params.limit));
  const suffix = qs.size > 0 ? `?${qs}` : '';
  return api.get<{ requests: AccessRequestResponse[] }>(`/access-requests${suffix}`);
}

export function approveAccessRequest(id: string) {
  return api.post<{ id: string; state: 'approved' }>(`/access-requests/${id}/approve`);
}

export function denyAccessRequest(id: string) {
  return api.post<{ id: string; state: 'denied' }>(`/access-requests/${id}/deny`);
}
