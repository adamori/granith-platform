import { NOTIFY_HTTP_TIMEOUT_MS } from '../../../lib/constants.js';
import type { NotificationDriver, DeliveryResult, NotificationMessage } from '../types.js';
import { sanitizeProviderMessage } from '../types.js';

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export const pushoverDriver: NotificationDriver = {
  type: 'pushover',

  validateCredential(cred) {
    if (typeof cred !== 'object' || cred === null) {
      return { ok: false, error: 'Pushover credential must be an object' };
    }
    const { app_token, user_key } = cred as Record<string, unknown>;
    if (!isNonEmptyString(app_token)) return { ok: false, error: 'app_token is required' };
    if (!isNonEmptyString(user_key)) return { ok: false, error: 'user_key is required' };
    return { ok: true, normalized: { app_token: app_token.trim(), user_key: user_key.trim() } };
  },

  async send(cred, msg: NotificationMessage): Promise<DeliveryResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NOTIFY_HTTP_TIMEOUT_MS);
    try {
      const form = new URLSearchParams();
      form.set('token', cred.app_token ?? '');
      form.set('user', cred.user_key ?? '');
      form.set('title', msg.title);
      form.set('message', msg.body);
      const res = await fetch('https://api.pushover.net/1/messages.json', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
        signal: controller.signal,
      });

      if (res.ok) return { status: 'success' };

      let reason: string | undefined;
      try {
        const json = (await res.json()) as { errors?: string[] };
        reason = json.errors?.[0];
      } catch {
        /* ignore parse errors */
      }

      if (res.status === 429 || res.status >= 500) {
        return {
          status: 'transient_error',
          message: sanitizeProviderMessage(`Pushover ${res.status}: ${reason ?? 'temporary error'}`),
        };
      }
      return {
        status: 'client_error',
        message: sanitizeProviderMessage(`Pushover rejected (${res.status}): ${reason ?? 'check app token and user key'}`),
      };
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError';
      return {
        status: 'transient_error',
        message: aborted ? 'Pushover request timed out' : 'Pushover network error',
      };
    } finally {
      clearTimeout(timer);
    }
  },
};
