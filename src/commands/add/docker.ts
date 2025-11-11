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
import { safeWrite } from "../../utils/fsx.js";
import { runCommand } from "../../utils/runCommand.js";

async function addDockerScriptsToPackageJson(
  port: number,
  image: string,
  composeEnabled: boolean,
  force: boolean,
  logger: any
) {
  const pkgPath = path.join(process.cwd(), "package.json");

  try {
    const data = await fs.readFile(pkgPath, "utf8");
    const pkg = JSON.parse(data);

    pkg.scripts = pkg.scripts || {};

    const scriptsToAdd: Record<string, string> = {
      "docker:build": `docker build --platform=linux/amd64 -t ${image}:prod .`,
      "docker:run": `docker run --rm --name ${image}-prod -p ${port}:${port} ${image}:prod`,
    };

    // Only add compose scripts if compose is enabled
    if (composeEnabled) {
      scriptsToAdd["docker:dev:up"] = "docker compose -f docker-compose.dev.yml up --build";
      scriptsToAdd["docker:dev:down"] = "docker compose -f docker-compose.dev.yml down";
    }

    let modified = false;

    for (const [key, cmd] of Object.entries(scriptsToAdd)) {
      if (!pkg.scripts[key] || force) {
        pkg.scripts[key] = cmd;
        modified = true;
      }
    }

    if (modified) {
      await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
      logger.info("Updated package.json with Docker scripts");
    } else {
      logger.info("Docker scripts already exist in package.json (use --force to overwrite)");
    }
  } catch (err) {
    logger.error(`Failed to update package.json: ${err instanceof Error ? err.message : err}`);
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
    .option("--verbose", "Verbose logging", false)
    .option("--profile", "Enable detailed performance profiling")
    .option("--trace", "Output trace tree showing spans and durations")
    .option("--metrics <format>", "Output performance metrics (format: json)")
    .option("--log-data <mode>", "Log data introspection mode: off, summary, full")
    .option("--redact <keys>", "Additional comma-separated keys to redact")
    .option("--no-redact", "Disable redaction (local development only)")
    .action(
      async (opts: {
        node: string;
        port: string;
        image: string;
        withCompose?: boolean; // true if --with-compose passed
        compose?: boolean; // false if --no-compose passed
        force?: boolean;
        verbose?: boolean;
        profile?: boolean;
        trace?: boolean;
        metrics?: string;
        logData?: string;
        redact?: string;
        noRedact?: boolean;
      }) => {
        await runCommand(
          "add:docker",
          async ({ logger, profiler }) => {
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
              await safeWrite(
                dockerignorePath,
                dockerignoreTemplate(),
                opts.force ? { force: true, profiler, logger } : { profiler, logger }
              );
              createdFiles.push(".dockerignore");

              // Generate Dockerfile (production)
              const dockerfilePath = path.join(process.cwd(), "Dockerfile");
              await safeWrite(
                dockerfilePath,
                dockerfileTemplate(nodeVersion, port),
                opts.force ? { force: true, profiler, logger } : { profiler, logger }
              );
              createdFiles.push("Dockerfile");

              // Generate Dockerfile.dev (development)
              const dockerfileDevPath = path.join(process.cwd(), "Dockerfile.dev");
              await safeWrite(
                dockerfileDevPath,
                dockerfileDevTemplate(nodeVersion, port),
                opts.force ? { force: true, profiler, logger } : { profiler, logger }
              );
              createdFiles.push("Dockerfile.dev");

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
                await safeWrite(
                  composePath,
                  dockerComposeDevTemplate(port),
                  opts.force ? { force: true, profiler, logger } : { profiler, logger }
                );
                createdFiles.push("docker-compose.dev.yml");
              } else {
                logger.info(`- Docker Compose: skipped (disabled via flag or config)`);
              }

              // Update package.json with Docker scripts
              await addDockerScriptsToPackageJson(
                port,
                opts.image,
                composeEnabled,
                !!opts.force,
                logger
              );

              // Log results
              if (createdFiles.length) {
                logger.info(`Created ${createdFiles.join(", ")}`);
              } else {
                logger.info(
                  `Nothing created. All targets already exist. Use --force to overwrite.`
                );
              }

              logger.info(`\nDocker configuration generated with:`);
              logger.info(`- Node.js version: ${nodeVersion}`);
              logger.info(`- Port: ${port}`);
              logger.info(`- Image name: ${opts.image}`);
              logger.info(`- Docker Compose: ${composeEnabled ? "enabled" : "disabled"}`);
              if (composeEnabled && !opts.withCompose && opts.compose !== false) {
                logger.info(`  (from config default: dockerCompose=${config.dockerCompose})`);
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              logger.error(`add:docker failed: ${msg}`);
              process.exitCode = 1;
              throw err;
            }
          },
          {
            verbose: opts.verbose,
            profile: opts.profile,
            trace: opts.trace,
            metricsJson: opts.metrics === "json",
            logData: opts.logData,
            redact: opts.redact,
            noRedact: opts.noRedact === true,
          }
        );
      }
    );
}
