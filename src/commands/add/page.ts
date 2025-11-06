import path from "node:path";

import type { Command } from "commander";

import { loadConfig } from "../../config/loadConfig.js";
import {
  generatePageTemplate,
  generateLayoutTemplate,
  generateApiRouteTemplate,
  generatePageTestTemplate,
} from "../../templates/index.js";
import { ensureDir, safeWrite } from "../../utils/fsx.js";
import { updatePageManifest } from "../../utils/manifest.js";
import { resolveAppRoot } from "../../utils/resolveAppRoot.js";
import { runCommand } from "../../utils/runCommand.js";
import { validatePageRoute } from "../../utils/validate.js";

export function registerAddPage(program: Command) {
  program
    .command("add:page")
    .description("Create a page under app/")
    .argument("<route>", "Route path like 'reports' or 'account/settings'")
    .option("--app <dir>", "App directory (default: app)")
    .option("--async", "Generate an async server component", false)
    .option("--client", "Generate a client component", false)
    .option("--force", "Overwrite existing files", false)
    .option("--layout", "Create layout.tsx", false)
    .option("--api", "Create API route (route.ts)", false)
    .option("--skip-page", "Skip creating page.tsx (use with --api)", false)
    .option("--group <name>", "Wrap in route group, e.g., auth creates (auth)/route")
    .option("--with-tests", "Create test file", false)
    .option("--verbose", "Verbose logging", false)
    .option("--profile", "Enable detailed performance profiling")
    .option("--metrics <format>", "Output performance metrics (format: json)")
    .action(
      async (
        route: string,
        opts: {
          app?: string;
          async?: boolean;
          client?: boolean;
          force?: boolean;
          layout?: boolean;
          api?: boolean;
          skipPage?: boolean;
          group?: string;
          withTests?: boolean;
          verbose?: boolean;
          profile?: boolean;
          metrics?: string;
        }
      ) => {
        await runCommand(
          "add:page",
          async ({ logger, profiler }) => {
            try {
              logger.debug({ route, opts }, "add:page called with options");

              // Validation step
              const validateStep = profiler.step("validate options and route");

              // Check mutually exclusive flags
              if (opts.async && opts.client) {
                console.error("Choose exactly one of --async or --client");
                process.exitCode = 1;
                const err = new Error("Choose exactly one of --async or --client") as Error & {
                  exitCode: number;
                };
                err.exitCode = 1;
                throw err;
              }

              // Check --skip-page without --api
              if (opts.skipPage && !opts.api) {
                console.error("Cannot use --skip-page without --api");
                console.error(
                  "Hint: use --api to create an API route, or omit --skip-page to create a page"
                );
                process.exitCode = 1;
                const err = new Error("Cannot use --skip-page without --api") as Error & {
                  exitCode: number;
                };
                err.exitCode = 1;
                throw err;
              }

              // Validate route
              try {
                validatePageRoute(route);
              } catch (err) {
                if (err instanceof Error && err.message === "Invalid segment") {
                  console.error("Invalid segment");
                  process.exitCode = 1;
                  const validationErr = new Error("Invalid segment") as Error & {
                    exitCode: number;
                  };
                  validationErr.exitCode = 1;
                  throw validationErr;
                }
                throw err;
              }

              validateStep.end();

              // Load config and resolve app directory
              const configStep = profiler.step("load config");
              const config = await loadConfig({ cwd: process.cwd() });
              const appDir = await resolveAppRoot({
                ...(opts.app && { appFlag: opts.app }),
                ...(config.pagesDir && { configPagesDir: config.pagesDir }),
                createIfMissing: false, // pages must error if the app dir is missing
              });
              configStep.end();

              // Generate page path with optional route group
              const generateStep = profiler.step("generate files");
              let routeSegments = route.split("/").filter(Boolean);
              if (opts.group) {
                // Wrap in route group: (groupName)
                const groupName = opts.group.startsWith("(") ? opts.group : `(${opts.group})`;
                routeSegments = [groupName, ...routeSegments];
              }
              const pageDir = path.join(appDir, ...routeSegments);
              await ensureDir(pageDir);

              // Write page file unless --skip-page is set
              if (!opts.skipPage) {
                const pagePath = path.join(pageDir, "page.tsx");
                const lastSegment = routeSegments[routeSegments.length - 1];
                const template = generatePageTemplate(!!opts.client, !!opts.async, lastSegment);
                await safeWrite(
                  pagePath,
                  template,
                  opts.force ? { force: true, profiler } : { profiler }
                );
              }

              // Write layout file if --layout is set
              if (opts.layout) {
                const layoutPath = path.join(pageDir, "layout.tsx");
                const layoutTemplate = generateLayoutTemplate(!!opts.client);
                await safeWrite(
                  layoutPath,
                  layoutTemplate,
                  opts.force ? { force: true, profiler } : { profiler }
                );
              }

              // Write API route file if --api is set
              if (opts.api) {
                const apiPath = path.join(pageDir, "route.ts");
                const apiTemplate = generateApiRouteTemplate();
                await safeWrite(
                  apiPath,
                  apiTemplate,
                  opts.force ? { force: true, profiler } : { profiler }
                );
              }

              // Write test file if --with-tests is set
              if (opts.withTests) {
                const testDir = path.join(pageDir, "__tests__");
                await ensureDir(testDir);
                const testPath = path.join(testDir, "page.test.tsx");
                const testTemplate = generatePageTestTemplate(route);
                await safeWrite(
                  testPath,
                  testTemplate,
                  opts.force ? { force: true, profiler } : { profiler }
                );
              }

              generateStep.end();

              // Update page manifest
              const manifestStep = profiler.step("update manifest");
              const manifestRoute = routeSegments.join("/");
              await updatePageManifest(appDir, manifestRoute);
              manifestStep.end();

              logger.info({ route: manifestRoute }, "Page created successfully");
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              if (msg.includes("Invalid segment") || msg.toLowerCase().includes("invalid")) {
                console.error("Invalid segment");
                process.exitCode = 1;
                throw err; // Re-throw for tests
              } else if (msg.includes("App directory not found")) {
                console.error(msg);
                process.exitCode = 1;
                throw err; // Re-throw for tests
              } else {
                console.error(msg);
                process.exitCode = 1;
                throw err; // Re-throw for tests
              }
            }
          },
          {
            verbose: opts.verbose,
            profile: opts.profile,
            metricsJson: opts.metrics === "json",
          }
        );
      }
    );
}
