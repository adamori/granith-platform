import type { ColumnType, Generated, JSONColumnType } from 'kysely';

export interface Database {
  users: UsersTable;
  sessions: SessionsTable;
  opaque_login_state: OpaqueLoginStateTable;
  projects: ProjectsTable;
  secrets: SecretsTable;
  tokens: TokensTable;
  audit_log: AuditLogTable;
  notification_services: NotificationServicesTable;
  notification_service_projects: NotificationServiceProjectsTable;
  notification_deliveries: NotificationDeliveriesTable;
  access_requests: AccessRequestsTable;
}

export interface UsersTable {
  id: Generated<string>;
  handle: string;
  kdf_params: JSONColumnType<KdfParams>;
  opaque_record: Buffer;
  // Invite code redeemed at signup (invite-era accounts); otherwise null.
  invite_code_used: string | null;
  limit_overrides: ColumnType<Partial<UserLimits> | null, string | null | undefined, string | null>;
  created_at: ColumnType<Date, string | undefined, string | undefined>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface KdfParams {
  algorithm: string;
  time_cost: number;
  memory_cost: number;
  parallelism: number;
  salt_length: number;
}

export interface UserLimits {
  storage_bytes: number;
}

export interface SessionsTable {
  id: Generated<string>;
  user_id: string;
  expires_at: Date;
  created_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface OpaqueLoginStateTable {
  id: Generated<string>;
  // Null for login attempts against handles that do not exist — we still create a
  // state row (using a dummy OPAQUE record) so the response is indistinguishable
  // from a real account. Such rows can never complete login.
  user_id: string | null;
  state: Buffer;
  expires_at: Date;
}

export interface ProjectsTable {
  id: Generated<string>;
  owner_id: string;
  name_ct: Buffer;
  name_nonce: Buffer;
  wrapped_pdk_for_user: Buffer;
  wrap_nonce_for_user: Buffer;
  created_at: ColumnType<Date, string | undefined, string | undefined>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
  deleted_at: Date | null;
  require_approval: ColumnType<boolean, boolean | undefined, boolean>;
}

export interface SecretsTable {
  id: Generated<string>;
  project_id: string;
  owner_id: string;
  wrapped_item_key: Buffer;
  wik_nonce: Buffer;
  name_ct: Buffer;
  name_nonce: Buffer;
  value_ct: Buffer;
  value_nonce: Buffer;
  version: ColumnType<number, number | undefined, number>;
  created_at: ColumnType<Date, string | undefined, string | undefined>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
  deleted_at: Date | null;
}

export interface TokensTable {
  token_id: Buffer;
  project_id: string;
  owner_id: string;
  wrapped_pdk: Buffer;
  wrap_nonce: Buffer;
  scopes: JSONColumnType<TokenScopes>;
  label_ct: Buffer | null;
  label_nonce: Buffer | null;
  ip_allowlist: string[] | null;
  expires_at: Date;
  created_at: ColumnType<Date, string | undefined, string | undefined>;
  last_used_at: Date | null;
  revoked_at: Date | null;
  usage_counter: number | null;
}

export interface TokenScopes {
  read: boolean;
  write?: boolean;
}

export interface AuditLogTable {
  id: Generated<string>;
  actor_type: 'user' | 'token';
  actor_id: string;
  project_id: string | null;
  action: string;
  resource_id: string | null;
  ip: string | null;
  user_agent: string | null;
  metadata: JSONColumnType<Record<string, unknown>> | null;
  ts: ColumnType<Date, string | undefined, string | undefined>;
}

export type NotificationDriver = 'telegram' | 'pushover';
export type ThrottleMode = 'cooldown' | 'every' | 'new_source_only';
export type NotificationState = 'enabled' | 'disabled' | 'probation' | 'permanently_disabled';

export interface NotificationTriggers {
  bundle_pull: boolean;
  dashboard_read: boolean;
  // Critical trigger — dispatched regardless of this flag; absent in older rows.
  approval_request?: boolean;
  [key: string]: boolean | undefined;
}

export interface NotificationThrottle {
  mode: ThrottleMode;
  cooldown_minutes?: number;
  new_source_window_minutes?: number;
}

export interface NotificationServicesTable {
  id: Generated<string>;
  owner_id: string;
  driver: NotificationDriver;
  label: string | null;
  credential_ct: Buffer;
  credential_nonce: Buffer;
  watch_all_projects: ColumnType<boolean, boolean | undefined, boolean>;
  triggers: JSONColumnType<NotificationTriggers, string | undefined, string>;
  throttle: JSONColumnType<NotificationThrottle, string | undefined, string>;
  state: ColumnType<NotificationState, NotificationState | undefined, NotificationState>;
  consecutive_client_errors: ColumnType<number, number | undefined, number>;
  last_error: string | null;
  last_error_at: Date | null;
  last_sent_at: Date | null;
  disabled_at: Date | null;
  disabled_until: Date | null;
  created_at: ColumnType<Date, string | undefined, string | undefined>;
  updated_at: ColumnType<Date, string | undefined, string | undefined>;
}

export interface NotificationServiceProjectsTable {
  service_id: string;
  project_id: string;
}

export interface NotificationDeliveriesTable {
  id: Generated<string>;
  service_id: string;
  project_id: string | null;
  trigger_type: string;
  status: 'success' | 'client_error' | 'transient_error';
  error_message: string | null;
  created_at: ColumnType<Date, string | undefined, string | undefined>;
}

export type AccessRequestState = 'pending' | 'approved' | 'denied' | 'expired' | 'consumed';
export type AccessRequestVia = 'link' | 'dashboard' | 'telegram_callback';

export interface AccessRequestsTable {
  id: Generated<string>;
  token_id: Buffer;
  project_id: string;
  owner_id: string;
  state: ColumnType<AccessRequestState, AccessRequestState | undefined, AccessRequestState>;
  link_nonce: Buffer;
  requester_ip: string | null;
  requester_user_agent: string | null;
  decided_at: Date | null;
  decided_via: AccessRequestVia | null;
  consumed_at: Date | null;
  created_at: ColumnType<Date, string | undefined, string | undefined>;
  expires_at: Date;
}
