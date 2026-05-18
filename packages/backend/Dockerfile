# Build context: repo root (because tsconfig.json extends ../../tsconfig.base.json).
# Build with: docker build -f packages/backend/Dockerfile .

# ============================================================
# Stage 1: Install all deps (cached on package.json + bun.lock)
# ============================================================
FROM oven/bun:1.3.12-alpine AS deps

WORKDIR /app
COPY tsconfig.base.json ./
COPY packages/backend/package.json packages/backend/bun.lock ./packages/backend/

WORKDIR /app/packages/backend
RUN bun install --frozen-lockfile

# ============================================================
# Stage 2: Compile TypeScript with tsc
# ============================================================
FROM deps AS builder

COPY packages/backend/tsconfig.json ./
COPY packages/backend/src ./src

RUN bun run build

# ============================================================
# Stage 3: Production-only deps
# ============================================================
FROM oven/bun:1.3.12-alpine AS prod-deps

WORKDIR /app/packages/backend
COPY packages/backend/package.json packages/backend/bun.lock ./
RUN bun install --frozen-lockfile --production

# ============================================================
# Stage 4: Runtime — node Alpine, non-root, minimal layers
# ============================================================
FROM node:22-alpine AS runtime

RUN addgroup -S app && adduser -S app -G app
WORKDIR /app

COPY --from=builder --chown=app:app /app/packages/backend/dist ./dist
# Migrations are .sql files — tsc doesn't copy them. Bring them along so
# `node dist/db/migrate.js up` works inside the running container.
COPY --from=builder --chown=app:app /app/packages/backend/src/db/migrations ./dist/db/migrations
COPY --from=prod-deps --chown=app:app /app/packages/backend/node_modules ./node_modules
COPY --chown=app:app packages/backend/package.json ./

USER app

ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]
