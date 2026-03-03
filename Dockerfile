FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# ---- Install dependencies ----
FROM base AS deps
WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json pnpm-workspace.yaml turbo.json ./
COPY pnpm-lock.yaml* ./

# All workspace package.json files must be present for pnpm workspace resolution
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/
COPY packages/cloud-init/package.json ./packages/cloud-init/
COPY packages/runtime-agent/package.json ./packages/runtime-agent/
COPY functions/package.json ./functions/

RUN pnpm install --no-frozen-lockfile

# ---- Build ----
FROM base AS builder
WORKDIR /app

# Copy the full node_modules virtual store from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Copy source for packages in the web dependency graph only
COPY turbo.json ./
COPY apps/web ./apps/web
COPY packages ./packages

# Build web and its workspace dependencies (@tulip/cloud-init, @tulip/types)
RUN pnpm exec turbo run build --filter=@tulip/web...

# ---- Production image ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# Copy the standalone output (includes all required node_modules via file tracing)
COPY --from=builder /app/apps/web/.next/standalone ./
# Static assets and public files are not included in standalone and must be copied separately
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 8080

# server.js path mirrors the monorepo structure due to outputFileTracingRoot
CMD ["node", "apps/web/server.js"]
