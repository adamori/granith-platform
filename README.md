# Granith

Zero-knowledge secrets manager for application config and environment variables. The server never sees plaintext — decryption happens only inside the SDKs running in your applications.

> **Status:** alpha · invite-only · not production-ready.
> See [granith.dev](https://granith.dev) for the longer pitch and the invite request form.

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
  sdk-go/     Go SDK + granith CLI
```

## Local development

Requires Docker, [Bun](https://bun.sh), and Go 1.24+ (only for the SDK/CLI).

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

The backend `.env.example` documents required variables. `OPAQUE_SERVER_SETUP` must be generated once and kept stable for the lifetime of the database; see `packages/backend/src` for the helper.

## Security

If you've found a vulnerability, please report it privately. See [`SECURITY.md`](./SECURITY.md).

## License

[AGPL-3.0](./LICENSE). Network use is distribution under this license.
