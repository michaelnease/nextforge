import path from "node:path";

import type { Command } from "commander";

import { loadConfig } from "../../config/loadConfig.js";
import { layoutTemplate, readmeTemplate } from "../../templates/index.js";
import { ensureDir, safeWrite } from "../../utils/fsx.js";
import { resolveAppRoot } from "../../utils/resolveAppRoot.js";
import { runCommand } from "../../utils/runCommand.js";
import { validateGroupName } from "../../utils/validate.js";

/**
 * Parse comma-separated pages list
 */
function parsePages(pagesArg?: string): string[] {
  if (!pagesArg?.trim()) return [];
  return pagesArg
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Generate page code with data-testid
 */
function pageCode(name: string): string {
  return `export default function Page() {
  return <div data-testid="${name}">${name}</div>;
}
`;
}

export function registerAddGroup(program: Command) {
  program
    .command("add:group")
    .description("Create a Next.js App Router route group, e.g. (auth)")
    .argument("<name>", "Route group name, with or without parentheses, e.g. auth or (auth)")
    .option("--app <dir>", "App directory", "app")
    .option("--with-layout", "Create layout.tsx in the group", false)
    .option("--with-tests", "Generate test files for pages", false)
    .option("--no-readme", "Skip creating a README.md")
    .option("--force", "Overwrite existing files", false)
    .option(
      "--pages <list>",
      'Comma-separated child leaf segments to seed, e.g. signin,signup,reset or [slug],[...rest]. Note: quote bracket args in zsh: --pages "signin,[slug]"'
    )
    .option("--verbose", "Verbose logging", false)
    .option("--profile", "Enable detailed performance profiling")
    .option("--trace", "Output trace tree showing spans and durations")
    .option("--metrics <format>", "Output performance metrics (format: json)")
    .option("--log-data <mode>", "Log data introspection mode: off, summary, full")
    .option("--redact <keys>", "Additional comma-separated keys to redact")
    .option("--no-redact", "Disable redaction (local development only)")
    .action(async (name, opts) => {
      await runCommand(
        "add:group",
        async ({ logger, profiler }) => {
          try {
            // Validate and normalize group name
            let group: string;
            try {
              group = validateGroupName(name);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              if (msg.includes("reserved") || msg.includes('"api"')) {
                console.error(msg);
              } else {
                console.error(`add:group failed: ${msg}`);
              }
              process.exitCode = 1;
              throw err;
            }

            // Check for unsafe paths (traversal) in the original app arg BEFORE resolving
            if (opts.app) {
              const pathParts = opts.app.split(/[/\\]/);
              if (pathParts.some((p: string) => p === "." || p === "..")) {
                const err = new Error(`Refusing to create unsafe app directory: ${opts.app}`);
                // Write directly to stderr for E2E tests
                process.stderr.write(err.message + "\n");
                process.exitCode = 1;
                throw err; // Re-throw for tests
              }
            }

            // Resolve app directory with path normalization
            const config = await loadConfig({ cwd: process.cwd() });
            const appDir = await resolveAppRoot({
              ...(opts.app && { appFlag: opts.app }),
              ...(config.pagesDir && { configPagesDir: config.pagesDir }),
              createIfMissing: true, // groups are allowed to create the app dir
            });

            const groupDir = path.join(appDir, group);
            await ensureDir(groupDir);

            if (opts.withLayout) {
              await safeWrite(
                path.join(groupDir, "layout.tsx"),
                layoutTemplate(),
                opts.force ? { force: true, profiler, logger } : { profiler, logger }
              );
            }

            // Negated option: --no-readme sets opts.readme === false
            if (opts.readme !== false) {
              await safeWrite(
                path.join(groupDir, "README.md"),
                readmeTemplate(group),
                opts.force ? { force: true, profiler, logger } : { profiler, logger }
              );
            }

            // Parse and create pages
            const pages = parsePages(opts.pages);
            for (const pageName of pages) {
              // Handle "index" page specially: put it in groupDir/index/page.tsx
              const pageDir =
                pageName === "index" ? path.join(groupDir, "index") : path.join(groupDir, pageName);
              await ensureDir(pageDir);
              const pageFile = path.join(pageDir, "page.tsx");
              await safeWrite(
                pageFile,
                pageCode(pageName),
                opts.force ? { force: true, profiler, logger } : { profiler, logger }
              );

              // Create test file if --with-tests is set
              if (opts.withTests) {
                const testFile = path.join(pageDir, "page.test.tsx");
                const testCode = `import { render } from "@testing-library/react";
import Page from "./page";

// Note: This is a server component by default
test("renders", () => {
  render(<Page />);
});
`;
                await safeWrite(
                  testFile,
                  testCode,
                  opts.force ? { force: true, profiler, logger } : { profiler, logger }
                );
              }
            }

            const rel = path.relative(process.cwd(), groupDir) || groupDir;
            logger.info(`Created route group at ${rel}`);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes("reserved") || msg.includes('"api"')) {
              console.error(msg);
              process.exitCode = 1;
              throw err; // Re-throw for tests
            } else if (msg.includes("Refusing to create unsafe")) {
              console.error(msg);
              process.exitCode = 1;
              throw err; // Re-throw for tests
            } else {
              console.error(`add:group failed: ${msg}`);
              process.exitCode = 1;
              throw err; // Re-throw for tests
            }
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
    });
}
