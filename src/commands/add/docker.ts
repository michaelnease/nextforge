import fs from "node:fs/promises";
import path from "node:path";

import type { Command } from "commander";

import { loadConfig } from "../../config/loadConfig.js";
import {
  dockerfileTemplate,
  dockerfileDevTemplate,
  dockerignoreTemplate,
  dockerComposeDevTemplate,
} from "../../templates/index.js";

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

export function registerAddDocker(program: Command) {
  program
    .command("add:docker")
    .description("Generate Docker configuration files for Next.js app")
    .option("--node <version>", "Node.js version", "22")
    .option("--port <number>", "Port number", "3000")
    .option("--image <name>", "Docker image name", "myapp")
    .option("--with-compose", "Generate docker-compose.dev.yml (default: true, configurable)")
    .option("--no-compose", "Skip generating docker-compose.dev.yml")
    .option("--force", "Overwrite existing files")
    .action(
      async (opts: {
        node: string;
        port: string;
        image: string;
        withCompose?: boolean; // true if --with-compose passed
        compose?: boolean; // false if --no-compose passed
        force?: boolean;
      }) => {
        try {
          const createdFiles: string[] = [];

          // Load config for defaults
          const config = await loadConfig({ cwd: process.cwd() });

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

          // Generate docker-compose.dev.yml
          // Priority: --with-compose (explicit yes) > --no-compose (explicit no) > config default
          let composeEnabled = config.dockerCompose; // Default from config

          if (opts.withCompose !== undefined) {
            composeEnabled = true; // --with-compose explicitly requested
          } else if (opts.compose === false) {
            composeEnabled = false; // --no-compose explicitly requested
          }

          if (composeEnabled) {
            const composePath = path.join(process.cwd(), "docker-compose.dev.yml");
            if (await writeIfAbsent(composePath, dockerComposeDevTemplate(port), !!opts.force)) {
              createdFiles.push("docker-compose.dev.yml");
            }
          } else {
            console.log(`- Docker Compose: skipped (disabled via flag or config)`);
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
          console.log(`- Image name: ${opts.image}`);
          console.log(`- Docker Compose: ${composeEnabled ? "enabled" : "disabled"}`);
          if (composeEnabled && !opts.withCompose && opts.compose !== false) {
            console.log(`  (from config default: dockerCompose=${config.dockerCompose})`);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`add:docker failed: ${msg}`);
          process.exitCode = 1;
        }
      }
    );
}
