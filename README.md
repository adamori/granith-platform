# Granith

Zero-knowledge secrets manager for application config and environment variables. The server never sees plaintext — decryption happens only inside the SDKs running in your applications.

> **Status:** v1.0 — generally available. Registration is open; sign up at [app.granith.dev](https://app.granith.dev). Still single-user: one account, no teams, no shared vaults.
> Free to use, with a single fair-use limit — 1 MB of encrypted storage per user. Hit it, tell the maintainer what you're building, and it's raised at no cost.
> See [granith.dev](https://granith.dev) for the longer pitch.

## Why

- **Server can't decrypt.** Authentication uses an aPAKE (OPAQUE, RFC 9807) so the server never learns the password. Each secret is wrapped by a per-secret subkey, itself wrapped by a key derived from the user password. The server stores only ciphertext.
- **SDK-only decryption.** Plaintext exists only inside the running application that imports a granith SDK. There is no server endpoint that returns plaintext.
- **Portable Postgres.** Backed by plain Postgres (no Supabase/RLS/PostgREST coupling). Moving providers is a connection string change.

## Repo layout

```
packages/
  backend/    Node 24 / Fastify 5 / TypeScript API server
  frontend/   SvelteKit SPA — vault UI (app.granith.dev)
  marketing/  Astro static site (granith.dev)
  sdk-go/     Go SDK + granith CLI — git submodule → github.com/adamori/granith
```

`packages/sdk-go` is a submodule; its source of truth is the standalone [`adamori/granith`](https://github.com/adamori/granith) repo.

## Local development

Requires Docker, [Bun](https://bun.sh), and Go 1.24+ (only for the SDK/CLI).

Clone with the SDK submodule:

```bash
git clone --recurse-submodules git@github.com:adamori/granith-platform.git
# already cloned? pull it in:
git submodule update --init packages/sdk-go
```

```bash
# 1. Start local Postgres
docker compose up -d

# 2. Backend
cd packages/backend
cp ../../.env.example .env       # then edit OPAQUE_SERVER_SETUP, ADMIN_KEY, SESSION_SECRET
bun install
bun run migrate up
bun run dev                       # listens on :3000

# 3. Frontend (in a new terminal)
cd packages/frontend
cp .env.example .env              # leave PUBLIC_API_BASE_URL empty in dev (Vite proxy handles it)
bun install
bun run dev                       # listens on :5173

# 4. Marketing site (optional)
cd packages/marketing
bun install
bun run dev

# 5. Go SDK / CLI (optional)
cd packages/sdk-go
go test ./...
go install ./cmd/granith
```

The backend `.env.example` documents required variables. `OPAQUE_SERVER_SETUP` must be generated once and kept stable for the lifetime of the database; see `packages/backend/src` for the helper. Registration is open by default; set `REGISTRATION_MODE=closed` to turn new signups off without a redeploy (see [Administration](#administration)).

### Working on the SDK

Commit and push SDK changes inside `packages/sdk-go` (they land on `adamori/granith`), then bump the pin here:

```bash
cd packages/sdk-go && git add -A && git commit && git push   # push to granith
cd ../.. && git add packages/sdk-go && git commit -m "chore: bump sdk-go"
```

## Administration

The backend ships a `granith-admin` CLI (the `granith-admin` bin from the built package). It calls the API using `GRANITH_API_URL` and `GRANITH_ADMIN_KEY` (the shared `ADMIN_KEY`).

**Fair use.** Granith is free, and stays free. The only limit is total encrypted storage per user — **1 MB** by default. It counts every encrypted byte a user owns: secrets, project rows, tokens, and notification credentials, including soft-deleted projects. There are no object-count or per-secret caps; a single write is separately bounded by `BODY_LIMIT` (512 KB). If you hit the cap, email the maintainer (`adam@alibiro.com`, Telegram [@paneelmaja](https://t.me/paneelmaja)), say what you're building, and it's raised — for free.

Authenticated users can check their own usage at `GET /api/usage` (storage used/limit, object counts, and how to ask for more); the vault UI shows this as a meter in settings.

Per-user overrides live in `users.limit_overrides` and are managed with the CLI (or the underlying `GET`/`PUT /api/admin/users/:handle/limits` API):

```bash
granith-admin limits show  <handle>              # a user's current usage and effective limits
granith-admin limits set   <handle> 10MB         # raise their storage cap (bytes or KB/MB/GB)
granith-admin limits clear <handle>              # drop overrides, back to the 1 MB default
```

**Closing registration.** Registration is open by default. Set `REGISTRATION_MODE=closed` (env var, `open` | `closed`) to reject all new signups without a redeploy — an emergency brake. Existing users are unaffected.

## Security

If you've found a vulnerability, please report it privately. See [`SECURITY.md`](./SECURITY.md).

## License

[AGPL-3.0](./LICENSE). Network use is distribution under this license.
