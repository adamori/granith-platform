# Granith Platform — Security Audit

**Date:** 2026-06-10
**Scope:** `packages/backend` (Fastify API), `packages/frontend` (SvelteKit vault UI),
`packages/sdk-go` (Go SDK + CLI), plus build/deploy configuration. Commit at audit time:
`2fef169` on `main`.
**Method:** Manual source review of all server routes, authentication/authorization,
cryptographic handling, the notification subsystem, the Go SDK, and the
infrastructure (Dockerfile, docker-compose, CI workflow).

---

## Summary

The core zero-knowledge design is sound and carefully implemented: secrets are
encrypted client-side with XChaCha20-Poly1305 (libsodium), the password-derived KEK
uses Argon2id, authentication uses the OPAQUE aPAKE so the server never receives the
password, and the server stores only ciphertext. Queries are parameterized throughout
(Kysely), the admin key check is constant-time, security headers and cookie flags are
sensible, and the Go client pins TLS 1.3 and zeroizes key material.

The audit found **one access-control bug worth fixing promptly** (a missing ownership
check on secret updates) and **one privacy weakness** (login handle enumeration that
OPAQUE is specifically designed to prevent). The remainder are low-severity hardening
items and informational notes, several of which stem from this being an explicitly
alpha, single-maintainer project.

| # | Severity | Finding |
|---|----------|---------|
| 1 | High | Missing project-ownership check on `PUT` secret update (IDOR / tampering) |
| 2 | Medium | Account handle enumeration via `login/start` response shape |
| 3 | Low | `/v1/bundle` ignores token `scopes` |
| 4 | Low | Rate limits and throttle state are per-process (ineffective when scaled out) |
| 5 | Low | `SESSION_SECRET` is required but never used |
| 6 | Low | Notification credential key derived via a single unsalted SHA-256 |
| 7 | Info | `usage_counter` is surfaced but never incremented |
| 8 | Info | CLI `export` dotenv/json output can be corrupted by crafted secret names |
| 9 | Info | Admin actions are not attributable to an individual (shared `ADMIN_KEY`) |

---

## Findings

### 1. Missing ownership check on secret update — broken access control (High)

**File:** `packages/backend/src/routes/secrets/by-id.ts` (PUT handler, lines 11–50)

The `PUT /api/projects/:id/secrets/:sid` handler updates a secret filtering only on
`id = sid`, `project_id = projectId`, and `deleted_at is null`:

```ts
const result = await db
  .updateTable('secrets')
  .set({ /* ... new ciphertext ... */ })
  .where('id', '=', sid)
  .where('project_id', '=', projectId)
  .where('deleted_at', 'is', null)
  .returning(['id', 'version', 'updated_at'])
  .executeTakeFirst();
```

There is no check that the project (or the secret) belongs to the authenticated user.
This is inconsistent with its siblings, which all enforce ownership:

- the **DELETE** handler immediately below adds `.where('owner_id', '=', request.user!.id)`;
- the **POST** create handler in `routes/secrets/index.ts` calls `verifyProjectOwnership(...)`;
- the **GET** list handler also calls `verifyProjectOwnership(...)`.

**Impact.** Any authenticated user who learns another user's `project_id` and
`secret_id` can overwrite that secret's ciphertext, nonce, and item key — i.e. destroy
or tamper with another tenant's secret (an integrity/availability break). Because the
payload is end-to-end encrypted, the attacker cannot *read* the victim's secret this
way, and both identifiers are unguessable UUIDv4 values exposed only to the owner, so
practical exploitation requires the IDs to leak (logs, screenshots, a former
collaborator, a captured bundle response). It is nonetheless a genuine missing
authorization control and should be treated as defense-in-depth that is currently
broken.

**Fix.** Mirror the create/delete handlers — verify project ownership before the
update, or add `.where('owner_id', '=', request.user!.id)` to the update (the `secrets`
table already has an `owner_id` column), and treat a zero-row result as 404.

---

### 2. Account handle enumeration on login (Medium)

**File:** `packages/backend/src/routes/auth/login.ts` (lines 44–74)

`POST /api/auth/login/start` returns different responses depending on whether the handle
exists:

- unknown handle → immediate `401 UNAUTHORIZED` ("Invalid credentials");
- known handle → `200` with a real OPAQUE `loginResponse` and a `login_id`.

OPAQUE is specifically designed to defeat this: the server is supposed to return a
*simulated* (consistent dummy) login response for unknown users so that existing and
non-existing accounts are indistinguishable to the client. As written, an attacker can
enumerate which handles are registered. The same existence oracle is present at
`register/start`/`register/finish` (a `409 Handle already taken`), though registration
enumeration is more commonly accepted and is gated behind a valid invite.

**Impact.** Privacy leak of the user base / valid-handle discovery, which also aids
targeted password attacks. Low exploitation complexity.

**Fix.** For an unknown handle, generate and return a deterministic simulated OPAQUE
login response (the `@serenity-kit/opaque` server supports producing a response from a
fake record derived from the server setup + identifier) and create a throwaway login
state, so the start response is byte-shape-identical to the known-handle path. Keep the
per-handle and per-IP rate limits that are already in place.

---

### 3. Bundle endpoint does not enforce token scopes (Low)

**File:** `packages/backend/src/routes/bundle/index.ts` (`authenticateToken`, lines 33–87)

Tokens carry a `scopes` object (`{ read, write? }`, see `schemas/tokens.ts` and the
`tokens` table). The `/v1/bundle` handler authenticates the token (format, existence,
revocation, expiry, IP allowlist) but never inspects `scopes`. Today only `read: true`
is ever minted by the UI, so there is no live impact — but the presence of a scopes
field implies an enforcement that does not exist. A future `read: false` or write-only
token would still be able to pull the full bundle.

**Fix.** Check `token.scopes.read === true` before assembling the bundle and reject with
403 otherwise, so the field is authoritative.

---

### 4. Rate-limit and throttle state is per-process (Low)

**Files:** `plugins/rate-limit.ts`, `routes/auth/login.ts` (`loginHandleBuckets`),
`routes/bundle/index.ts` (`tokenBuckets`), `services/notify/dispatch.ts` (`sourceSeen`)

All abuse-control state lives in in-memory `Map`s / the default `@fastify/rate-limit`
store:

- global and per-route IP rate limits,
- the per-handle login attempt bucket,
- the per-token bundle-fetch bucket,
- the `new_source_only` notification throttle "recently seen sources" set.

The Dockerfile and CI build a stateless image clearly intended to scale horizontally.
Across N replicas behind a load balancer, every limit becomes effectively N× looser,
and all of it resets on restart/redeploy. The `new_source_only` notification trigger in
particular can both miss and double-fire depending on which replica handles a request.
The code comments already acknowledge the throttle is best-effort and process-local.

**Note / Fix.** This overlaps with the project's documented "DoS via rate-limited
endpoints is a known tradeoff" stance, so it may be accepted for alpha. If/when running
more than one instance, back the rate limiter and throttle with a shared store (e.g.
Redis, which `@fastify/rate-limit` supports) and persist or centralize the
"seen sources" set.

---

### 5. `SESSION_SECRET` is required but unused (Low)

**Files:** `config.ts` (line 7), `.env.example` (line 4)

`SESSION_SECRET` is validated as a mandatory ≥32-char value, and the README instructs
operators to set it, but it is never referenced anywhere in the codebase. Session
cookies are unsigned raw `gen_random_uuid()` values looked up directly in the `sessions`
table (`services/session.ts`, `plugins/auth.ts`). The current scheme is acceptable
because the IDs are high-entropy random and server-side validated, but the unused config
is misleading: an operator may believe cookies are cryptographically signed/MAC'd when
they are not.

**Fix.** Either remove `SESSION_SECRET` from the config/schema/docs, or actually use it
to sign the session cookie (e.g. via `@fastify/cookie`'s signed-cookie support, which is
already registered) so tampering is detectable.

---

### 6. Notification credential key derived via single unsalted SHA-256 (Low)

**File:** `packages/backend/src/lib/notify-crypto.ts` (`deriveKey`, lines 12–14)

`NOTIFY_ENCRYPTION_KEY` is converted into the AES-256-GCM key with a single unsalted
`SHA-256(masterKey)`. The encryption itself is correct (random 12-byte IV per record,
GCM auth tag prepended, authenticated decryption). For a high-entropy 32+ character
secret this is adequate, but a single fast hash offers no resistance if the configured
key is weak, and the same derived key is used for every record. This is the documented
*server-side* credential path (Telegram/Pushover tokens the server must read at send
time), not the zero-knowledge path, so the blast radius is limited to third-party
notification credentials.

**Fix (hardening).** Use a labeled/derivation function (e.g. HKDF with a fixed salt and
info label) instead of a bare SHA-256, and document a minimum-entropy expectation for the
key. Consider per-record key separation if the threat model warrants it.

---

### 7. `usage_counter` surfaced but never incremented (Informational)

**Files:** `routes/tokens/index.ts` (returned in the token list), `routes/bundle/index.ts`

The `tokens.usage_counter` column is selected and returned to the dashboard, but no code
path ever increments it (only `last_used_at` is updated on bundle fetch). The dashboard
therefore always shows a null/empty usage count, which is misleading for an operator
trying to spot anomalous token use.

**Fix.** Either increment it atomically alongside the `last_used_at` update, or remove it
from the schema/response.

---

### 8. CLI `export` output can be corrupted by crafted secret names (Informational)

**File:** `packages/sdk-go/cmd/granith/export.go` (lines 45–65)

`export --format dotenv` emits `NAME=VALUE` lines with no escaping of `NAME`, and values
are unquoted. A secret name containing a newline or `=` could inject additional dotenv
entries or split a value; the `shell` format quotes values but not names. Secrets are
authored by the same owner, so this is self-inflicted at worst (low risk), but a garbled
or maliciously crafted name could silently corrupt a downstream `.env`. The `json` format
uses `%q` and is safe.

**Fix.** Validate/sanitize secret names on write (the UI is the natural place), or reject
names containing `=`, newlines, or leading/trailing whitespace at export time.

---

### 9. Admin actions are not individually attributable (Informational)

**Files:** `routes/admin/invites.ts`, `routes/admin/users.ts`

Admin endpoints are gated by a single shared `ADMIN_KEY` (constant-time compared — good),
and audit entries for admin actions record `actor_id: 'admin'` literally, with invite
`created_by: null`. There is no way to attribute an admin action (invite creation, user
deletion) to a specific human. Acceptable for a single-maintainer alpha; worth revisiting
if more than one operator ever holds the key.

---

## Positive observations

These are things the audit specifically checked and found done well:

- **Zero-knowledge crypto is correctly implemented.** Client-side XChaCha20-Poly1305 via
  libsodium; PDK and item keys generated client-side; PDK wrapped per-user (Argon2id KEK)
  and per-token; the server stores and serves only ciphertext (`services/bundle.ts` never
  has access to plaintext or unwrapping keys). The Go SDK unwraps locally and zeroizes
  keys after use.
- **OPAQUE aPAKE** means the password and password-equivalent material never reach the
  server; login state is single-use (deleted on finish) and TTL-bounded (60s), with
  periodic cleanup.
- **No SQL injection surface.** All access goes through Kysely with parameterized
  queries; migrations run via `node-pg-migrate`.
- **Constant-time admin key comparison** with an explicit length guard
  (`plugins/admin-auth.ts`).
- **Sensible HTTP hardening:** strict Helmet CSP (`frame-ancestors 'none'`,
  `object-src 'none'`, no inline script), cookies are `HttpOnly` + `Secure` in prod +
  `SameSite=Lax`, and CORS is locked to a single configured origin with credentials.
  `SameSite=Lax` combined with the absence of state-changing GET routes effectively
  mitigates CSRF.
- **Good log redaction:** passwords, OPAQUE messages, wrapped keys, credentials, and auth
  headers are all in the pino redact list (`app.ts`).
- **Token controls:** expiry (capped at 1095 days), revocation, optional IP allowlist
  (with IPv4-mapped-IPv6 normalization), and PDK rotation that revokes all project tokens.
- **Tenant isolation elsewhere is correct:** project, token, audit, and notification
  routes consistently scope by `owner_id` (finding #1 is the lone exception).
- **Container hygiene:** multi-stage build, runs as a non-root `app` user, frozen
  lockfiles, production-only deps in the runtime image.
- **Transport security in the SDK:** `tls.VersionTLS13` minimum enforced in the Go client.

---

## Recommended priority

1. **Fix #1** (add the ownership check to secret update) — small, contained change that
   closes a real authorization gap.
2. **Fix #2** (simulated OPAQUE response for unknown handles) — restores a property the
   chosen auth protocol is meant to provide.
3. Address #3 and #5 as quick correctness/clarity fixes.
4. Plan #4 and #6 before scaling beyond a single instance or hardening for GA.
5. Treat #7–#9 as cleanup/observability backlog.
