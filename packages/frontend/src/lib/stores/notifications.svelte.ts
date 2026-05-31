import * as notifyApi from '../api/notifications.js';
import type { NotificationService, CreateNotificationBody, PatchNotificationBody } from '../api/notifications.js';

let services = $state<NotificationService[]>([]);

export function getServices() {
  return services;
}

export async function loadServices() {
  const { services: list } = await notifyApi.listNotifications();
  services = list;
}

export async function addService(body: CreateNotificationBody) {
  await notifyApi.createNotification(body);
  await loadServices();
}

export async function editService(nid: string, body: PatchNotificationBody) {
  await notifyApi.patchNotification(nid, body);
  await loadServices();
}

export async function removeService(nid: string) {
  await notifyApi.deleteNotification(nid);
  await loadServices();
}
