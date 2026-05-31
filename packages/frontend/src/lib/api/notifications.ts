import { api } from './client.js';

export type NotificationDriver = 'telegram' | 'pushover';
export type ThrottleMode = 'cooldown' | 'every' | 'new_source_only';
export type NotificationState = 'enabled' | 'disabled' | 'probation' | 'permanently_disabled';

export interface NotificationTriggers {
  bundle_pull: boolean;
  dashboard_read: boolean;
  [key: string]: boolean;
}

export interface NotificationThrottle {
  mode: ThrottleMode;
  cooldown_minutes?: number;
  new_source_window_minutes?: number;
}

export interface NotificationService {
  id: string;
  driver: NotificationDriver;
  label: string | null;
  watch_all_projects: boolean;
  project_ids: string[];
  triggers: NotificationTriggers;
  throttle: NotificationThrottle;
  state: NotificationState;
  consecutive_client_errors: number;
  last_error: string | null;
  last_error_at: string | null;
  last_sent_at: string | null;
  disabled_until: string | null;
  created_at: string;
}

export interface DeliveryEntry {
  id: string;
  service_id: string;
  project_id: string | null;
  trigger_type: string;
  status: 'success' | 'client_error' | 'transient_error';
  error_message: string | null;
  created_at: string;
}

// Credential shape depends on driver:
//   telegram -> { bot_token, chat_id }
//   pushover -> { app_token, user_key }
export type Credential = Record<string, string>;

export interface CreateNotificationBody {
  driver: NotificationDriver;
  credential: Credential;
  label?: string | null;
  watch_all_projects?: boolean;
  project_ids?: string[];
  triggers?: NotificationTriggers;
  throttle?: NotificationThrottle;
}

export interface PatchNotificationBody {
  label?: string | null;
  credential?: Credential;
  watch_all_projects?: boolean;
  project_ids?: string[];
  triggers?: NotificationTriggers;
  throttle?: NotificationThrottle;
  state?: 'enabled';
}

export function listNotifications() {
  return api.get<{ services: NotificationService[] }>('/notifications');
}

export function createNotification(body: CreateNotificationBody) {
  return api.post<{ id: string }>('/notifications', body);
}

export function patchNotification(nid: string, body: PatchNotificationBody) {
  return api.patch<{ ok: boolean }>(`/notifications/${nid}`, body);
}

export function deleteNotification(nid: string) {
  return api.del(`/notifications/${nid}`);
}

export function listDeliveries(params?: { service_id?: string; limit?: number; offset?: number }) {
  const qs = new URLSearchParams();
  if (params?.service_id) qs.set('service_id', params.service_id);
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.offset) qs.set('offset', String(params.offset));
  const query = qs.toString();
  return api.get<{ entries: DeliveryEntry[] }>(`/notifications/deliveries${query ? '?' + query : ''}`);
}
