import { api } from './client.js';

export interface UsageStorage {
  used_bytes: number;
  limit_bytes: number;
}

export interface UsageObjects {
  projects: number;
  secrets: number;
  tokens: number;
  notification_services: number;
}

export interface UsageContact {
  email: string;
  telegram: string;
}

export interface UsageResponse {
  storage: UsageStorage;
  objects: UsageObjects;
  override_active: boolean;
  contact: UsageContact;
}

export function getUsage() {
  return api.get<UsageResponse>('/usage');
}
