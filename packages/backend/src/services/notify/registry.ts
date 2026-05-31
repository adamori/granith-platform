import type { NotificationDriver } from './types.js';
import { telegramDriver } from './drivers/telegram.js';
import { pushoverDriver } from './drivers/pushover.js';

const drivers: Record<string, NotificationDriver> = {
  telegram: telegramDriver,
  pushover: pushoverDriver,
};

export function getDriver(type: string): NotificationDriver | undefined {
  return drivers[type];
}

export const DRIVER_TYPES = Object.keys(drivers);
