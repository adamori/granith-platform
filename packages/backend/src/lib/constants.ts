export const TOKEN_TTL_DEFAULT_DAYS = 90;
export const TOKEN_TTL_MAX_DAYS = 1095;
export const SESSION_TTL_DAYS = 7;
export const OPAQUE_LOGIN_STATE_TTL_SECONDS = 60;
export const AUDIT_RETENTION_DAYS = 365;
export const CLIPBOARD_CLEAR_HINT_MINUTES = 10;

export const NOTIFY_DELIVERY_RETENTION_DAYS = 7;
export const NOTIFY_CLIENT_ERROR_DISABLE_THRESHOLD = 3;
export const NOTIFY_AUTO_REENABLE_HOURS = 3;
export const NOTIFY_DEFAULT_COOLDOWN_MINUTES = 15;
export const NOTIFY_DEFAULT_NEW_SOURCE_WINDOW_MINUTES = 60;
export const NOTIFY_HTTP_TIMEOUT_MS = 8_000;
export const NOTIFY_MAX_SERVICES_PER_USER = 20;

export const RATE_LIMITS = {
  loginStart: { perHandle: 5, perIp: 20, windowMs: 60_000 },
  bundle: { perTokenId: 60, perIp: 600, windowMs: 60_000 },
} as const;
