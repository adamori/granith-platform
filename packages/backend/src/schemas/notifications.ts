import { z } from 'zod';

const triggersSchema = z
  .object({
    bundle_pull: z.boolean(),
    dashboard_read: z.boolean(),
    approval_request: z.boolean().optional(),
  })
  .catchall(z.boolean());

const throttleSchema = z.object({
  mode: z.enum(['cooldown', 'every', 'new_source_only']),
  cooldown_minutes: z.number().int().min(1).max(1440).optional(),
  new_source_window_minutes: z.number().int().min(1).max(1440).optional(),
});

const telegramCred = z.object({
  bot_token: z.string().min(1),
  chat_id: z.string().min(1),
});

const pushoverCred = z.object({
  app_token: z.string().min(1),
  user_key: z.string().min(1),
});

const watchScope = {
  watch_all_projects: z.boolean().default(false),
  project_ids: z.array(z.string().uuid()).default([]),
  triggers: triggersSchema.default({ bundle_pull: true, dashboard_read: false }),
  throttle: throttleSchema.default({ mode: 'cooldown', cooldown_minutes: 15 }),
  label: z.string().max(80).nullable().optional(),
};

export const createNotificationBody = z.discriminatedUnion('driver', [
  z.object({ driver: z.literal('telegram'), credential: telegramCred, ...watchScope }),
  z.object({ driver: z.literal('pushover'), credential: pushoverCred, ...watchScope }),
]);

export const patchNotificationBody = z.object({
  label: z.string().max(80).nullable().optional(),
  credential: z.union([telegramCred, pushoverCred]).optional(),
  watch_all_projects: z.boolean().optional(),
  project_ids: z.array(z.string().uuid()).optional(),
  triggers: triggersSchema.optional(),
  throttle: throttleSchema.optional(),
  state: z.literal('enabled').optional(), // manual re-enable only
});

export const notifyIdParam = z.object({
  nid: z.string().uuid(),
});

export const deliveriesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  service_id: z.string().uuid().optional(),
});
