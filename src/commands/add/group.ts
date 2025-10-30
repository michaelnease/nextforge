import fs from "node:fs/promises";
import path from "node:path";

import type { Command } from "commander";

import { loadConfig } from "../../utils/loadConfig.js";
import { mergeConfig } from "../../utils/mergeConfig.js";

/**
 * Normalize a route group name.
 * Accepts "auth" or "(auth)" and returns "(auth)".
 */
function normalizeGroupName(input: string) {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Group name is required");
  const name = trimmed.startsWith("(") && trimmed.endsWith(")") ? trimmed.slice(1, -1) : trimmed;
  if (!/^[a-z0-9-]+$/i.test(name)) {
    throw new Error(`Invalid group name "${name}". Use letters, numbers, and dashes only.`);
  }
  if (name.toLowerCase() === "api") {
    throw new Error('Group name "api" is reserved. Pick another.');
  }
  return `(${name})`;
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function assertDirExists(dir: string) {
  try {
    await fs.access(dir);
  } catch {
    throw new Error(`App directory not found: ${dir}`);
  }
}

/**
 * Write a file only if it doesn't exist unless --force is set.
 */
async function writeIfAbsent(filePath: string, contents: string, force = false) {
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

// [nextforge.templates:layout:start]
function layoutTemplate() {
  return `import React, { type ReactNode } from "react";

export default function GroupLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
// [nextforge.templates:layout:end]
`;
}

// [nextforge.templates:page.tailwind:start]
function pageTemplateTailwind(title: string) {
  // Pretty title for seeded pages: strip brackets, title-case segments, join with slash
  const pretty = title
    .replace(/[[\].]/g, "")
    .split("/")
    .map((s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s))
    .join(" / ");

  return `import React from "react";

export default async function Page() {
  return (
    <section className="p-8">
      <h1 className="text-2xl font-semibold">${pretty}</h1>
    </section>
  );
}
// [nextforge.templates:page.tailwind:end]
`;
}

// [nextforge.templates:page.basic:start]
function pageTemplateBasic(title: string) {
  const pretty = title
    .replace(/[[\].]/g, "")
    .split("/")
    .map((s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s))
    .join(" / ");

  return `import React from "react";

export default async function Page() {
  return (
    <section>
      <h1>${pretty}</h1>
    </section>
  );
}
// [nextforge.templates:page.basic:end]
`;
}

// [nextforge.templates:page.chakra:start]
function pageTemplateChakra(title: string) {
  const pretty = title
    .replace(/[[\].]/g, "")
    .split("/")
    .map((s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s))
    .join(" / ");

  return `import React from "react";
import { Container, Heading } from "@chakra-ui/react";

export default async function Page() {
  return (
    <Container py={8}>
      <Heading size="lg">${pretty}</Heading>
    </Container>
  );
}
// [nextforge.templates:page.chakra:end]
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

/**
 * Registers: nextforge add:group <name>
 * Examples:
 *   nextforge add:group auth --with-layout
 *   nextforge add:group (auth) --pages signin,signup,[slug],[...rest],[[...maybe]]
 *   nextforge add:group marketing --app apps/web/app --no-readme
 */
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
        const fileCfg = await loadConfig({ verbose: Boolean(program.opts().verbose) });
        const flagsCfg = { pagesDir: opts.app };
        const config = mergeConfig({ fileConfig: fileCfg, env: process.env, flags: flagsCfg });
        const group = normalizeGroupName(name);
        const appDir = path.resolve(process.cwd(), config.pagesDir);
        const groupDir = path.join(appDir, group);

        await assertDirExists(appDir);
        await ensureDir(groupDir);

        if (opts.withLayout) {
          await writeIfAbsent(path.join(groupDir, "layout.tsx"), layoutTemplate(), opts.force);
        }

        // Negated option: --no-readme sets opts.readme === false
        if (opts.readme) {
          await writeIfAbsent(path.join(groupDir, "README.md"), readmeTemplate(group), opts.force);
        }

        const parsePages = (input?: string): string[] => {
          if (!input) return [];
          return String(input)
            .split(",")
            .map((s) => s.trim().replace(/^\/+|\/+$/g, ""))
            .filter(Boolean)
            .filter((s) => s !== "." && s !== "..");
        };

        const DYNAMIC = /^\[\.{0,3}[a-zA-Z0-9_-]+\]$/; // [id], [...rest], [[...maybe]] (outer [[...]] not yet)
        const SEGMENT = /^[a-z0-9-]+$/i;
        const isValidPart = (part: string) => SEGMENT.test(part) || DYNAMIC.test(part);

        const rawSegments = Array.from(new Set(parsePages(opts.pages)));

        for (const raw of rawSegments) {
          const parts = raw.split("/").filter(Boolean);
          const invalid = parts.filter((p) => !isValidPart(p));
          if (invalid.length) {
            throw new Error(
              `Invalid page segment "${raw}". Bad parts: ${invalid.join(", ")}. ` +
                `Use names like "signin", "[id]", "[...rest]", or nested "settings/notifications".`
            );
          }
          const leafDir = path.join(groupDir, ...parts);
          await ensureDir(leafDir);
          const last = parts[parts.length - 1] || "page";
          const contents = config.useChakra
            ? pageTemplateChakra(last)
            : config.useTailwind
              ? pageTemplateTailwind(last)
              : pageTemplateBasic(last);
          await writeIfAbsent(path.join(leafDir, "page.tsx"), contents, opts.force);
        }

        const rel = path.relative(process.cwd(), groupDir) || groupDir;
        console.log(`Created route group at ${rel}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`add:group failed: ${msg}`);
        process.exitCode = 1;
      }
    });
}
