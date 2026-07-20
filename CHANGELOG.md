# Changelog

All notable changes to the Granith platform (backend, frontend, marketing site) are
documented in this file. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!--
The Go SDK and `granith` CLI live in packages/sdk-go (source of truth: the standalone
adamori/granith repo). They are versioned and tagged independently of the platform and
receive their own v1.0.0 tag in that repo — not here.
-->

## [Unreleased]

_Nothing yet._

## [1.0.0] - 2026-07-20

First generally-available release. Granith graduates from an invite-only alpha to an open,
free service.

> The Go SDK / `granith` CLI (`packages/sdk-go`, source of truth
> [`adamori/granith`](https://github.com/adamori/granith)) is versioned separately and
> receives its own `v1.0.0` tag in that repository.

### Added

- **Open registration** — anyone can sign up; no invite code required.
- **`REGISTRATION_MODE` env var** (`open` | `closed`, default `open`) — an emergency brake
  to close new signups without a redeploy.
- **Registration rate limits** — 5/min/IP on `register/start`, 10/day/IP on
  `register/finish`.
- **Fair-use storage limit** — a per-user cap on total encrypted storage, default **1 MB**,
  counting all user-owned encrypted bytes (secrets, project rows, tokens, and notification
  credentials, including soft-deleted projects). It is the only usage limit; a single write
  stays bounded by the 512 KB body limit, and there are no object-count or per-secret caps.
  Granith stays free — hit the cap, tell the maintainer what you're building, and it's
  raised at no cost.
- **Per-user limit overrides** — `users.limit_overrides` (jsonb), admin API
  `GET`/`PUT /api/admin/users/:handle/limits`, and CLI
  `granith-admin limits show|set|clear <handle>`.
- **`GET /api/usage`** — authenticated endpoint returning storage used/limit, object
  counts, and how to request more; surfaced as a usage meter in the vault settings UI.
- **Migrations** `015` (make `users.invite_code_used` nullable) and `016` (add
  `users.limit_overrides`).

### Changed

- Status is now **v1.0 / generally available**. The frontend and marketing site drop all
  alpha/beta/invite labels and show `v1.0`.
- Registration's `409 Handle already taken` response is no longer justified by the (now
  absent) invite gate. Self-service signup inherently reveals which handles are taken; the
  new registration rate limits are the mitigation. See the v1.0 addendum in
  [`SECURITY_AUDIT.md`](./SECURITY_AUDIT.md).
- Documentation updated for GA: `README.md`, `SECURITY.md` (GA but still single-maintainer),
  and a dated addendum appended to `SECURITY_AUDIT.md`.

### Removed

- **Invite-only registration** and all invite tooling — the admin invite endpoints
  (`/api/admin/invites`) and the `granith-admin invite create|list|revoke` CLI commands are
  deleted. The `invite_codes` table is retained as historical data (see migration `015`).
- Invite/beta/alpha labels and the invite-request form pointer across the frontend and
  marketing site.

[Unreleased]: https://github.com/adamori/granith-platform/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/adamori/granith-platform/releases/tag/v1.0.0
