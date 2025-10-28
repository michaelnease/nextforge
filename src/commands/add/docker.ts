import fs from "node:fs/promises";
import path from "node:path";

import type { Command } from "commander";

/** Write a file if missing, unless --force is set. */
async function writeIfAbsent(filePath: string, contents: string, force = false): Promise<boolean> {
  try {
    if (!force) {
      await fs.access(filePath);
      console.log(`skip  ${path.relative(process.cwd(), filePath)} (exists)`);
      return false;
    }
  } catch {
    // file missing, fall through and write
  }
  if (force) {
    console.log(`force overwrite -> ${path.relative(process.cwd(), filePath)}`);
  }
  await fs.writeFile(filePath, contents, "utf8");
  console.log(`write ${path.relative(process.cwd(), filePath)}`);
  return true;
}

function dockerfileTemplate(nodeVersion: string, port: number): string {
  return `# syntax=docker/dockerfile:1.7
# Multi-stage Dockerfile for Next.js production
FROM node:${nodeVersion}-alpine AS base
RUN corepack enable
WORKDIR /app

# Install dependencies only when needed
FROM base AS deps
# libc6-compat helps some native deps on alpine
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on lockfile present
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN --mount=type=cache,target=/root/.npm \\
    --mount=type=cache,target=/root/.pnpm-store \\
    --mount=type=cache,target=/usr/local/share/.cache/yarn \\
    if [ -f pnpm-lock.yaml ]; then pnpm i --frozen-lockfile; \\
    elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \\
    elif [ -f package-lock.json ]; then npm ci; \\
    else echo "Lockfile not found." && exit 1; fi

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# For smallest images, set output: "standalone" in next.config.mjs
# Uncomment the following line to disable telemetry during build:
# ENV NEXT_TELEMETRY_DISABLED=1
RUN --mount=type=cache,target=/app/.next/cache \\
    if [ -f pnpm-lock.yaml ]; then pnpm run build; \\
    elif [ -f yarn.lock ]; then yarn run build; \\
    elif [ -f package-lock.json ]; then npm run build; \\
    else echo "Lockfile not found." && exit 1; fi

# Production runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=${port}
ENV HOSTNAME=0.0.0.0
# Uncomment the following line to disable telemetry during runtime:
# ENV NEXT_TELEMETRY_DISABLED=1

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

EXPOSE ${port}

# If standalone build produced server.js, run it; else run next start
CMD if [ -f server.js ]; then node server.js; else npx --yes next start -p $PORT; fi
`;
}

function dockerfileDevTemplate(nodeVersion: string, port: number): string {
  return `# syntax=docker/dockerfile:1.7
# Development Dockerfile for Next.js
FROM node:${nodeVersion}-alpine
RUN corepack enable
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on lockfile present
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN --mount=type=cache,target=/root/.npm \\
    --mount=type=cache,target=/root/.pnpm-store \\
    --mount=type=cache,target=/usr/local/share/.cache/yarn \\
    if [ -f pnpm-lock.yaml ]; then pnpm i --frozen-lockfile; \\
    elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \\
    elif [ -f package-lock.json ]; then npm ci; \\
    else echo "Lockfile not found." && exit 1; fi

# Source will be bind-mounted in compose
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

function dockerignoreTemplate(): string {
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
`;
}

async function addDockerScriptsToPackageJson(port: number, image: string, force = false) {
  const pkgPath = path.join(process.cwd(), "package.json");

  try {
    const data = await fs.readFile(pkgPath, "utf8");
    const pkg = JSON.parse(data);

    pkg.scripts = pkg.scripts || {};

    const scriptsToAdd: Record<string, string> = {
      "docker:dev": "docker compose -f docker-compose.dev.yml up --build",
      "docker:down": "docker compose -f docker-compose.dev.yml down",
      "docker:build": `docker build -t ${image}:prod .`,
      "docker:run": `docker run -p ${port}:${port} ${image}:prod`,
    };

    let modified = false;

    for (const [key, cmd] of Object.entries(scriptsToAdd)) {
      if (!pkg.scripts[key] || force) {
        pkg.scripts[key] = cmd;
        modified = true;
      }
    }

    if (modified) {
      await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
      console.log("✅ Updated package.json with Docker scripts");
    } else {
      console.log("ℹ️ Docker scripts already exist in package.json (use --force to overwrite)");
    }
  } catch (err) {
    console.error(`❌ Failed to update package.json: ${err instanceof Error ? err.message : err}`);
  }
}
function dockerComposeDevTemplate(port: number): string {
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
    environment:
      - NODE_ENV=development
      - PORT=${port}
    stdin_open: true
    tty: true
`;
}

export function registerAddDocker(program: Command) {
  program
    .command("add:docker")
    .description("Generate Docker configuration files for Next.js app")
    .option("--node <version>", "Node.js version", "22")
    .option("--port <number>", "Port number", "3000")
    .option("--image <name>", "Docker image name", "myapp")
    .option("--compose", "Also generate docker-compose.dev.yml")
    .option("--force", "Overwrite existing files")
    .action(
      async (opts: {
        node: string;
        port: string;
        image: string;
        compose?: boolean;
        force?: boolean;
      }) => {
        try {
          const createdFiles: string[] = [];

          // Validate Node version
          const nodeVersion = opts.node;
          if (!/^\d+$/.test(nodeVersion)) {
            throw new Error(
              `Invalid Node version "${nodeVersion}". Use a number like 18, 20, or 22.`
            );
          }

          // Validate port
          const port = parseInt(opts.port, 10);
          if (isNaN(port) || port < 1 || port > 65535) {
            throw new Error(`Invalid port "${opts.port}". Use a number between 1 and 65535.`);
          }

          // Generate .dockerignore
          const dockerignorePath = path.join(process.cwd(), ".dockerignore");
          if (await writeIfAbsent(dockerignorePath, dockerignoreTemplate(), !!opts.force)) {
            createdFiles.push(".dockerignore");
          }

          // Generate Dockerfile (production)
          const dockerfilePath = path.join(process.cwd(), "Dockerfile");
          if (
            await writeIfAbsent(dockerfilePath, dockerfileTemplate(nodeVersion, port), !!opts.force)
          ) {
            createdFiles.push("Dockerfile");
          }

          // Generate Dockerfile.dev (development)
          const dockerfileDevPath = path.join(process.cwd(), "Dockerfile.dev");
          if (
            await writeIfAbsent(
              dockerfileDevPath,
              dockerfileDevTemplate(nodeVersion, port),
              !!opts.force
            )
          ) {
            createdFiles.push("Dockerfile.dev");
          }

          // Generate docker-compose.dev.yml (optional)
          if (opts.compose) {
            const composePath = path.join(process.cwd(), "docker-compose.dev.yml");
            if (await writeIfAbsent(composePath, dockerComposeDevTemplate(port), !!opts.force)) {
              createdFiles.push("docker-compose.dev.yml");
            }
          }

          // Update package.json with Docker scripts
          await addDockerScriptsToPackageJson(port, opts.image, !!opts.force);

          // Log results
          if (createdFiles.length) {
            console.log(`Created ${createdFiles.join(", ")}`);
          } else {
            console.log(`Nothing created. All targets already exist. Use --force to overwrite.`);
          }

          console.log(`\nDocker configuration generated with:`);
          console.log(`- Node.js version: ${nodeVersion}`);
          console.log(`- Port: ${port}`);
          if (opts.compose) {
            console.log(`- Docker Compose: enabled`);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`add:docker failed: ${msg}`);
          process.exitCode = 1;
        }
      }
    );
}
