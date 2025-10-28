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

function dockerfileDevTemplate(nodeVersion: string, port: number): string {
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

async function addDockerScriptsToPackageJson(port: number, image: string, force = false) {
  const pkgPath = path.join(process.cwd(), "package.json");

  try {
    const data = await fs.readFile(pkgPath, "utf8");
    const pkg = JSON.parse(data);

    pkg.scripts = pkg.scripts || {};

    const scriptsToAdd: Record<string, string> = {
      "docker:dev": "docker compose -f docker-compose.dev.yml up --build",
      "docker:down": "docker compose -f docker-compose.dev.yml down",
      "docker:build": `docker build --platform=linux/amd64 -t ${image}:prod .`,
      "docker:run": `docker run --rm --name ${image}-prod -p ${port}:${port} ${image}:prod`,
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

export function registerAddDocker(program: Command) {
  program
    .command("add:docker")
    .description("Generate Docker configuration files for Next.js app")
    .option("--node <version>", "Node.js version", "22")
    .option("--port <number>", "Port number", "3000")
    .option("--image <name>", "Docker image name", "myapp")
    // Commander creates a boolean option `compose` that defaults to true.
    // Passing --no-compose will set opts.compose === false.
    .option("--no-compose", "Skip generating docker-compose.dev.yml (enabled by default)")
    .option("--force", "Overwrite existing files")
    .action(
      async (opts: {
        node: string;
        port: string;
        image: string;
        compose?: boolean; // true by default, false if --no-compose passed
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

          // Generate docker-compose.dev.yml (enabled by default unless --no-compose)
          const composeEnabled = opts.compose !== false;
          if (composeEnabled) {
            const composePath = path.join(process.cwd(), "docker-compose.dev.yml");
            if (await writeIfAbsent(composePath, dockerComposeDevTemplate(port), !!opts.force)) {
              createdFiles.push("docker-compose.dev.yml");
            }
          } else {
            console.log(`- Docker Compose: skipped (--no-compose)`);
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
          console.log(`- Docker Compose: ${composeEnabled ? "enabled" : "skipped"}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`add:docker failed: ${msg}`);
          process.exitCode = 1;
        }
      }
    );
}
