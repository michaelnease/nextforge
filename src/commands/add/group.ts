import fs from "node:fs/promises";
import path from "node:path";

import type { Command } from "commander";

import { loadConfig } from "../../config/loadConfig.js";
import { ensureDir } from "../../utils/fsx.js";
import { resolveAppRoot } from "../../utils/resolveAppRoot.js";
import { validateGroupName } from "../../utils/validate.js";

/**
 * Write a file only if it doesn't exist unless --force is set.
 */
async function writeIfAbsent(filePath: string, contents: string, force = false): Promise<void> {
  if (!force) {
    try {
      await fs.access(filePath);
      return; // exists, do not overwrite
    } catch {
      // not found, fall through to write
    }
  }
  await fs.writeFile(filePath, contents, "utf8");
}

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

function layoutTemplate() {
  return `import React, { type ReactNode } from "react";

export default function GroupLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
`;
}

function readmeTemplate(groupLabel: string) {
  return `# ${groupLabel} route group

This is a Next.js **route group**. The folder name is wrapped in parentheses so it does **not** affect the URL path.
Use this folder to organize segments like auth flows, marketing sections, experiments, or feature areas.

- Add child segments under this folder, e.g. \`(auth)/signin/page.tsx\`
- Optional \`layout.tsx\` here will wrap all child routes under the group.
`;
}

export function registerAddGroup(program: Command) {
  program
    .command("add:group")
    .description("Create a Next.js App Router route group, e.g. (auth)")
    .argument("<name>", "Route group name, with or without parentheses, e.g. auth or (auth)")
    .option("--app <dir>", "App directory", "app")
    .option("--with-layout", "Create layout.tsx in the group", false)
    .option("--no-readme", "Skip creating a README.md")
    .option("--force", "Overwrite existing files", false)
    .option(
      "--pages <list>",
      "Comma-separated child leaf segments to seed, e.g. signin,signup,reset or [slug],[...rest]"
    )
    .action(async (name, opts) => {
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
          return;
        }

        // Check for unsafe paths (traversal) in the original app arg BEFORE resolving
        if (opts.app) {
          const pathParts = opts.app.split(/[/\\]/);
          if (pathParts.some((p: string) => p === "." || p === "..")) {
            const err = new Error(`Refusing to create unsafe app directory: ${opts.app}`);
            console.error(err.message);
            process.exitCode = 1;
            throw err; // Re-throw for tests
          }
        }

        // Resolve app directory with path normalization
        const config = await loadConfig(process.cwd());
        const appDir = await resolveAppRoot({
          ...(opts.app && { appFlag: opts.app }),
          ...(config.pagesDir && { configPagesDir: config.pagesDir }),
          createIfMissing: true, // groups are allowed to create the app dir
        });

        const groupDir = path.join(appDir, group);
        await ensureDir(groupDir);

        if (opts.withLayout) {
          await writeIfAbsent(path.join(groupDir, "layout.tsx"), layoutTemplate(), opts.force);
        }

        // Negated option: --no-readme sets opts.readme === false
        if (opts.readme !== false) {
          await writeIfAbsent(path.join(groupDir, "README.md"), readmeTemplate(group), opts.force);
        }

        // Parse and create pages
        const pages = parsePages(opts.pages);
        for (const pageName of pages) {
          const pageDir = path.join(groupDir, pageName);
          await ensureDir(pageDir);
          const pageFile = path.join(pageDir, "page.tsx");
          await writeIfAbsent(pageFile, pageCode(pageName), opts.force);
        }

        const rel = path.relative(process.cwd(), groupDir) || groupDir;
        console.log(`Created route group at ${rel}`);
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
    });
}
