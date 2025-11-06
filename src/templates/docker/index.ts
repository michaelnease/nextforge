export function dockerfileTemplate(nodeVersion: string, port: number): string {
  return `# syntax=docker/dockerfile:1.7
FROM node:${nodeVersion}-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN --mount=type=cache,target=/root/.npm \\
    --mount=type=cache,target=/root/.pnpm-store \\
    --mount=type=cache,target=/usr/local/share/.cache/yarn \\
    if [ -f pnpm-lock.yaml ]; then pnpm i --frozen-lockfile; \\
    elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \\
    elif [ -f package-lock.json ]; then npm ci; \\
    else echo "Lockfile not found." && exit 1; fi

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public
# ENV NEXT_TELEMETRY_DISABLED=1
RUN --mount=type=cache,target=/app/.next/cache \\
    if [ -f pnpm-lock.yaml ]; then pnpm run build; \\
    elif [ -f yarn.lock ]; then yarn run build; \\
    elif [ -f package-lock.json ]; then npm run build; \\
    else echo "Lockfile not found." && exit 1; fi

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=${port}
ENV HOSTNAME=0.0.0.0
ENV NODE_OPTIONS=--max-old-space-size=1536
# ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

RUN mkdir -p .next && chown -R nextjs:nodejs /app
USER nextjs

EXPOSE ${port}

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \\
  CMD node -e "require('http').get('http://127.0.0.1:${port}/', r => process.exit(r.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))"

CMD if [ -f server.js ]; then node server.js; else npx --yes next start -p $PORT; fi
`;
}

export function dockerfileDevTemplate(nodeVersion: string, port: number): string {
  return `# syntax=docker/dockerfile:1.7
FROM node:${nodeVersion}-alpine
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN --mount=type=cache,target=/root/.npm \\
    --mount=type=cache,target=/root/.pnpm-store \\
    --mount=type=cache,target=/usr/local/share/.cache/yarn \\
    if [ -f pnpm-lock.yaml ]; then pnpm i --frozen-lockfile; \\
    elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \\
    elif [ -f package-lock.json ]; then npm ci; \\
    else echo "Lockfile not found." && exit 1; fi

COPY . .

EXPOSE ${port} 9229
ENV NODE_ENV=development
ENV PORT=${port}

CMD if [ -f pnpm-lock.yaml ]; then pnpm dev -p $PORT; \\
  elif [ -f yarn.lock ]; then yarn dev -p $PORT; \\
  elif [ -f package-lock.json ]; then npm run dev -- -p $PORT; \\
  else echo "Lockfile not found." && exit 1; fi
`;
}

export function dockerignoreTemplate(): string {
  return `# Dependencies
node_modules
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Next.js
.next/
out/

# Production
build
dist

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
logs
*.log

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage
*.lcov

# nyc test coverage
.nyc_output

# Dependency directories
jspm_packages/

# Optional npm cache directory
.npm

# Optional eslint cache
.eslintcache

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# parcel-bundler cache (https://parceljs.org/)
.cache
.parcel-cache

# Next.js build output
.next

# Nuxt.js build / generate output
.nuxt

# Gatsby files (keep Next.js public/)
.cache/

# Storybook build outputs
.out
.storybook-out

# Temporary folders
tmp/
temp/

# Editor directories and files
.vscode/
.idea/
*.swp
*.swo
*~

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Git
.git
.gitignore

# Misc
*.tsbuildinfo

# Test and tooling outputs
playwright-report
test-results
cypress
.turbo
.nx
.next/cache

# Docker
docker-compose*.yml
`;
}

export function dockerComposeDevTemplate(port: number): string {
  return `version: '3.8'

services:
  web:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "${port}:${port}"
      - "9229:9229"
    volumes:
      - .:/app
      - /app/node_modules
      - /app/.next
      - pnpm-store:/root/.pnpm-store
      - npm-cache:/root/.npm
    environment:
      - NODE_ENV=development
      - PORT=${port}
      - CHOKIDAR_USEPOLLING=1
      - WATCHPACK_POLLING=true
    stdin_open: true
    tty: true

volumes:
  pnpm-store:
  npm-cache:
`;
}
