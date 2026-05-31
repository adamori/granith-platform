export type DeliveryStatus = 'success' | 'client_error' | 'transient_error';

export interface DeliveryResult {
  status: DeliveryStatus;
  // Short, already-sanitized message safe to store and show to the user.
  // MUST NOT contain Granith infra detail (server IP, hostnames, request URLs, headers).
  message?: string;
}

export interface NotificationMessage {
  title: string;
  body: string;
}

export type CredentialValidation =
  | { ok: true; normalized: Record<string, string> }
  | { ok: false; error: string };

export interface NotificationDriver {
  readonly type: string;
  // Validate the shape of a credential object at registration time. No network.
  validateCredential(cred: unknown): CredentialValidation;
  // Perform the send. MUST classify the outcome and MUST NOT throw.
  send(cred: Record<string, string>, msg: NotificationMessage): Promise<DeliveryResult>;
}

// Cap stored provider messages so we never leak large payloads and keep the log tidy.
export function sanitizeProviderMessage(raw: string | undefined, max = 120): string | undefined {
  if (!raw) return undefined;
  const oneLine = raw.replace(/\s+/g, ' ').trim();
  if (!oneLine) return undefined;
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
}
