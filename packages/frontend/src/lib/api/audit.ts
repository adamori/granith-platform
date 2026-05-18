import { api } from './client.js';

export interface AuditEntry {
  id: string;
  actor_type: 'user' | 'token';
  actor_id: string;
  action: string;
  resource_id: string | null;
  ip: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  ts: string;
}

export function listAudit(projectId: string, params?: {
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.action) qs.set('action', params.action);
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.offset) qs.set('offset', String(params.offset));
  const query = qs.toString();
  return api.get<{ entries: AuditEntry[] }>(`/projects/${projectId}/audit${query ? '?' + query : ''}`);
}
