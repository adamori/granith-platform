import { NOTIFY_HTTP_TIMEOUT_MS } from '../../../lib/constants.js';
import type { NotificationDriver, DeliveryResult, NotificationMessage } from '../types.js';
import { sanitizeProviderMessage } from '../types.js';

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export const telegramDriver: NotificationDriver = {
  type: 'telegram',

  validateCredential(cred) {
    if (typeof cred !== 'object' || cred === null) {
      return { ok: false, error: 'Telegram credential must be an object' };
    }
    const { bot_token, chat_id } = cred as Record<string, unknown>;
    if (!isNonEmptyString(bot_token)) return { ok: false, error: 'bot_token is required' };
    if (!isNonEmptyString(chat_id)) return { ok: false, error: 'chat_id is required' };
    return { ok: true, normalized: { bot_token: bot_token.trim(), chat_id: chat_id.trim() } };
  },

  async send(cred, msg: NotificationMessage): Promise<DeliveryResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NOTIFY_HTTP_TIMEOUT_MS);
    try {
      const res = await fetch(`https://api.telegram.org/bot${cred.bot_token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: cred.chat_id,
          text: `${msg.title}\n\n${msg.body}`,
          disable_notification: false,
          ...(msg.actions?.length
            ? {
                // never preview/prefetch decision links
                link_preview_options: { is_disabled: true },
                reply_markup: {
                  inline_keyboard: [msg.actions.map((a) => ({ text: a.label, url: a.url }))],
                },
              }
            : {}),
        }),
        signal: controller.signal,
      });

      if (res.ok) return { status: 'success' };

      // Provider-side error reason only (no infra detail).
      let reason: string | undefined;
      try {
        const json = (await res.json()) as { description?: string };
        reason = json.description;
      } catch {
        /* ignore parse errors */
      }

      // 429 = rate limited (not the user's credential fault) -> transient.
      if (res.status === 429 || res.status >= 500) {
        return {
          status: 'transient_error',
          message: sanitizeProviderMessage(`Telegram ${res.status}: ${reason ?? 'temporary error'}`),
        };
      }
      // Other 4xx = bad token, invalid chat id, bot blocked -> user's config is wrong.
      return {
        status: 'client_error',
        message: sanitizeProviderMessage(`Telegram rejected (${res.status}): ${reason ?? 'check bot token and chat id'}`),
      };
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError';
      return {
        status: 'transient_error',
        message: aborted ? 'Telegram request timed out' : 'Telegram network error',
      };
    } finally {
      clearTimeout(timer);
    }
  },
};
