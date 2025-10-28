# syntax=docker/dockerfile:1.7
# Multi-stage Dockerfile for Next.js production
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# Install dependencies only when needed
FROM base AS deps
# libc6-compat helps some native deps on alpine
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on lockfile present
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=cache,target=/root/.pnpm-store \
    --mount=type=cache,target=/usr/local/share/.cache/yarn \
    if [ -f pnpm-lock.yaml ]; then pnpm i --frozen-lockfile; \
    elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    else echo "Lockfile not found." && exit 1; fi

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# For smallest images, set output: "standalone" in next.config.mjs
RUN --mount=type=cache,target=/app/.next/cache \
    if [ -f pnpm-lock.yaml ]; then pnpm run build; \
    elif [ -f yarn.lock ]; then yarn run build; \
    elif [ -f package-lock.json ]; then npm run build; \
    else echo "Lockfile not found." && exit 1; fi

# Production runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
ENV HOSTNAME=0.0.0.0

# non-root user
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
USER nextjs

# public assets
COPY --from=builder /app/public ./public || true

# Prefer standalone; fall back to regular .next + node_modules if not present
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./ || true
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next || true
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules || true
RUN mkdir -p .next && chown nextjs:nodejs .next

EXPOSE 4000

# If standalone build produced server.js, run it; else run next start
CMD if [ -f server.js ]; then node server.js; \
  elif [ -f pnpm-lock.yaml ]; then pnpm start -p $PORT; \
  elif [ -f yarn.lock ]; then yarn start -p $PORT; \
  else npm run start -- -p $PORT; fi
