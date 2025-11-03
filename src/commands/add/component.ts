// Intentionally unused import kept for possible future synchronous checks
// import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import type { Command } from "commander";

import { loadConfig } from "../../utils/loadConfig.js";
import { mergeConfig } from "../../utils/mergeConfig.js";

const MANIFEST_PATH = ".nextforge/manifest.json";

type Kind = "ui" | "layout" | "section" | "feature";

/**
 * Normalize component name to PascalCase and validate it.
 * Rejects names starting with numbers or containing illegal characters.
 */
function toPascalCase(input: string): string {
  const core = input.trim().replace(/[^a-zA-Z0-9]+/g, " ");
  if (!core) {
    throw new Error("Component name is required");
  }
  const name = core
    .split(" ")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join("");
  if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) {
    throw new Error(
      `Invalid component name "${input}". Use letters/numbers; must start with a letter.`
    );
  }
  return name;
}
async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

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

function withClientHeader(code: string, isClient: boolean) {
  return isClient ? `"use client";\n\n` + code : code;
}

function pascalProps(name: string) {
  return `${name}Props`;
}

async function readIfExists(file: string): Promise<string> {
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return "";
  }
}

/**
 * Convert a path to POSIX format (forward slashes) for consistent imports across OS.
 */
function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

/**
 * Generate export line with POSIX-normalized import path.
 * Calculates relative path from barrel file to component file.
 */
function generateExportLine(
  barrelPath: string,
  componentPath: string,
  componentName: string
): string {
  const importPath = toPosix(
    path.relative(path.dirname(barrelPath), componentPath).replace(/\.(tsx|ts|jsx|js)$/, "")
  );
  return `export { default as ${componentName} } from "${importPath}";`;
}

/**
 * Idempotently append export line to barrel file.
 * Checks for exact match before appending to avoid duplicates.
 * Preserves trailing newline.
 */
async function appendExportIfMissing(
  barrelPath: string,
  componentPath: string,
  componentName: string
): Promise<void> {
  const exportLine = generateExportLine(barrelPath, componentPath, componentName);
  let prior = "";
  try {
    prior = await fs.readFile(barrelPath, "utf8");
  } catch {
    // File doesn't exist yet
  }

  // Check if export line already exists
  if (!prior.split(/\r?\n/).some((line) => line.trim() === exportLine.trim())) {
    const prefixNL = prior && !prior.endsWith("\n") ? "\n" : "";
    const next = prior + prefixNL + exportLine + "\n";
    await fs.mkdir(path.dirname(barrelPath), { recursive: true });
    await fs.writeFile(barrelPath, next, "utf8");
  }
}

async function sortBarrel(kindIndexPath: string) {
  const cur = await readIfExists(kindIndexPath);
  // Filter out empty lines and invalid export lines, then sort and deduplicate
  const lines = cur
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && l.startsWith("export"))
    .filter((value, index, self) => self.indexOf(value) === index) // Deduplicate
    .sort();
  await fs.writeFile(kindIndexPath, lines.join("\n") + "\n", "utf8");
}

// ---- Templates ----
function tplBasic(name: string, isClient: boolean) {
  const props = pascalProps(name);
  const code = `import React from "react";

export interface ${props} {
  title?: string;
  subtitle?: string;
}

export default function ${name}({ title, subtitle }: ${props}) {
  return (
    <section>
      <h2>${name}</h2>
      {title ? <p>{title}</p> : null}
      {subtitle ? <p>{subtitle}</p> : null}
    </section>
  );
}
`;
  return withClientHeader(code, isClient);
}

function tplTailwind(name: string, isClient: boolean) {
  const props = pascalProps(name);
  const code = `import React from "react";

export interface ${props} {
  title?: string;
  subtitle?: string;
}

export default function ${name}({ title, subtitle }: ${props}) {
  return (
    <section className="p-6">
      <h2 className="text-xl font-semibold">${name}</h2>
      {title ? <p className="mt-2 text-gray-600">{title}</p> : null}
      {subtitle ? <p className="text-gray-500">{subtitle}</p> : null}
    </section>
  );
}
`;
  return withClientHeader(code, isClient);
}

function tplChakra(name: string, isClient: boolean) {
  const props = pascalProps(name);
  const code = `import React from "react";
import { Box, Heading, Text } from "@chakra-ui/react";

export interface ${props} {
  title?: string;
  subtitle?: string;
}

export default function ${name}({ title, subtitle }: ${props}) {
  return (
    <Box py={6}>
      <Heading size="md">${name}</Heading>
      {title ? <Text mt={2}>{title}</Text> : null}
      {subtitle ? <Text color="gray.500">{subtitle}</Text> : null}
    </Box>
  );
}
`;
  return withClientHeader(code, isClient);
}

// "both": Chakra primitives + Tailwind utility classes for teams migrating or mixing frameworks
function tplChakraTailwind(name: string, isClient: boolean) {
  const props = pascalProps(name);
  const code = `import React from "react";
import { Box, Heading, Text } from "@chakra-ui/react";

export interface ${props} {
  title?: string;
  subtitle?: string;
}

export default function ${name}({ title, subtitle }: ${props}) {
  return (
    <Box py={6} className="p-6">
      <Heading size="md" className="text-xl font-semibold">${name}</Heading>
      {title ? <Text mt={2} className="text-gray-600">{title}</Text> : null}
      {subtitle ? <Text className="text-gray-500">{subtitle}</Text> : null}
    </Box>
  );
}
`;
  return withClientHeader(code, isClient);
}

function tplLayoutBasic(name: string, isClient: boolean) {
  const props = pascalProps(name);
  const code = `import React, { type ReactNode } from "react";

export interface ${props} { children: ReactNode }

export default function ${name}({ children }: ${props}) {
  return <div>{children}</div>;
}
`;
  return withClientHeader(code, isClient);
}

function tplLayoutTailwind(name: string, isClient: boolean) {
  const props = pascalProps(name);
  const code = `import React, { type ReactNode } from "react";

export interface ${props} { children: ReactNode }

export default function ${name}({ children }: ${props}) {
  return <div className="container mx-auto px-4">{children}</div>;
}
`;
  return withClientHeader(code, isClient);
}

function tplLayoutChakra(name: string, isClient: boolean) {
  const props = pascalProps(name);
  const code = `import React, { type ReactNode } from "react";
import { Container } from "@chakra-ui/react";

export interface ${props} { children: ReactNode }

export default function ${name}({ children }: ${props}) {
  return <Container maxW="6xl" py={6}>{children}</Container>;
}
`;
  return withClientHeader(code, isClient);
}

// "both": Chakra Container with Tailwind layout classes
function tplLayoutChakraTailwind(name: string, isClient: boolean) {
  const props = pascalProps(name);
  const code = `import React, { type ReactNode } from "react";
import { Container } from "@chakra-ui/react";

export interface ${props} { children: ReactNode }

export default function ${name}({ children }: ${props}) {
  return <Container maxW="6xl" py={6} className="container mx-auto px-4">{children}</Container>;
}
`;
  return withClientHeader(code, isClient);
}

function chooseTemplate(
  kind: Kind,
  name: string,
  cfg: { useChakra?: boolean; useTailwind?: boolean },
  isClient: boolean
) {
  if (kind === "layout") {
    if (cfg.useChakra && cfg.useTailwind) return tplLayoutChakraTailwind(name, isClient);
    if (cfg.useChakra) return tplLayoutChakra(name, isClient);
    if (cfg.useTailwind) return tplLayoutTailwind(name, isClient);
    return tplLayoutBasic(name, isClient);
  }
  if (cfg.useChakra && cfg.useTailwind) return tplChakraTailwind(name, isClient);
  if (cfg.useChakra) return tplChakra(name, isClient);
  if (cfg.useTailwind) return tplTailwind(name, isClient);
  return tplBasic(name, isClient);
}

/**
 * Validate and normalize group option with helpful error message.
 */
function validateGroup(input: string | undefined): Kind {
  const allowed = ["ui", "layout", "section", "feature"] as const;
  const kind = (input ?? "ui").toLowerCase().trim() as Kind;
  if (!allowed.includes(kind)) {
    throw new Error(`Invalid --group "${input}". Use one of: ${allowed.join(", ")}`);
  }
  return kind;
}

/**
 * Get the component directory path based on group type.
 */
function getComponentDir(baseDir: string, group: Kind, subdirs: string[], leaf: string): string {
  return path.join(baseDir, "components", group, ...subdirs, leaf);
}

export function registerAddComponent(program: Command) {
  program
    .command("add:component")
    .description("Create a component in <app>/components/<group>/<Name>")
    .argument("<name>", "Component name, e.g. Button or marketing/Hero")
    .option("--group <type>", "Component group: ui | layout | section | feature", "ui")
    .option("--app <dir>", "App directory (default: app)", "app")
    .option(
      "--framework <name>",
      "Override template: chakra | tailwind | basic (takes precedence over config)"
    )
    .option("--client", "Mark as a client component", false)
    .option("--with-tests", "Create a basic test file", false)
    .option("--with-style", "Create a CSS or Chakra style file", false)
    .option("--with-story", "Create a Storybook story file", false)
    .option("--force", "Overwrite existing files", false)
    .action(async (name, opts) => {
      try {
        const kind = validateGroup(opts.group);

        const parts = String(name)
          .split("/")
          .map((s) => s.trim())
          .filter(Boolean);
        if (parts.some((p) => p === "." || p === "..")) {
          throw new Error("Component path cannot contain '.' or '..'.");
        }
        if (parts.length === 0) {
          throw new Error("Component name is required");
        }
        const leaf = toPascalCase(parts.pop()!);
        const subdirs = parts.map(toPascalCase);

        const fileCfg = await loadConfig({ verbose: !!program.opts().verbose });
        // Validate --framework flag if provided
        const allowed = ["chakra", "tailwind", "basic", "both"] as const;
        const fw = opts.framework ? String(opts.framework).toLowerCase().trim() : undefined;
        if (fw && !allowed.includes(fw as (typeof allowed)[number])) {
          throw new Error(
            `Invalid --framework "${opts.framework}". Use one of: ${allowed.join(", ")}`
          );
        }
        // Framework override: --framework takes precedence over config
        const fwOverride =
          fw === "chakra"
            ? { useChakra: true, useTailwind: false }
            : fw === "tailwind"
              ? { useChakra: false, useTailwind: true }
              : fw === "basic"
                ? { useChakra: false, useTailwind: false }
                : fw === "both"
                  ? { useChakra: true, useTailwind: true }
                  : {};
        const flagsCfg = {
          // Do not override pagesDir with --app here; prefer config.pagesDir
          ...fwOverride,
        } as Partial<{ pagesDir: string; useChakra: boolean; useTailwind: boolean }>;
        const config = mergeConfig({
          fileConfig: fileCfg,
          env: process.env,
          flags: flagsCfg as Partial<Record<string, unknown>>,
        });

        if (program.opts().verbose && fw) {
          console.log(`ℹ️  Framework override: ${fw} (overrides config)`);
        }

        const baseDir = path.resolve(process.cwd(), config.pagesDir);
        // Verify app directory exists
        try {
          await fs.access(baseDir);
        } catch {
          throw new Error(`App directory not found: ${baseDir}`);
        }
        const dir = getComponentDir(baseDir, kind, subdirs, leaf);

        await ensureDir(dir);

        const componentPath = path.join(dir, `${leaf}.tsx`);
        const indexPath = path.join(dir, "index.ts");

        const isClient = !!opts.client;
        const componentCode = chooseTemplate(
          kind,
          leaf,
          { useChakra: config.useChakra, useTailwind: config.useTailwind },
          isClient
        );

        if (program.opts().verbose) {
          const templateType =
            config.useChakra && config.useTailwind
              ? "Chakra+Tailwind"
              : config.useChakra
                ? "Chakra"
                : config.useTailwind
                  ? "Tailwind"
                  : "Basic";
          console.log(`ℹ️  Resolved framework: ${fw || "from config"}`);
          console.log(`ℹ️  Template: ${templateType}, Client: ${isClient}`);
          console.log(`ℹ️  App directory: ${config.pagesDir}`);
          console.log(`ℹ️  Component path: ${path.relative(process.cwd(), componentPath)}`);
          console.log(`ℹ️  Group: ${kind}`);
        }
        await writeIfAbsent(componentPath, componentCode, !!opts.force);

        const indexCode = `export { default } from "./${leaf}";\nexport * from "./${leaf}";\n`;
        await writeIfAbsent(indexPath, indexCode, !!opts.force);

        if (kind === "feature") {
          const hookPath = path.join(dir, `use${leaf}.ts`);
          const hookCode = `import { useState } from "react";
export function use${leaf}() {
  const [state, setState] = useState({});
  return { state, setState };
}
`;
          await writeIfAbsent(hookPath, hookCode, !!opts.force);
        }

        if (opts.withTests) {
          const testPath = path.join(dir, `${leaf}.test.tsx`);
          const testCode = `import { describe, it, expect } from "vitest";
import ${leaf} from "./${leaf}";
describe("${leaf}", () => {
  it("is defined", () => { expect(${leaf}).toBeDefined(); });
});
`;
          await writeIfAbsent(testPath, testCode, !!opts.force);
        }

        if (opts.withStyle) {
          if (config.useChakra) {
            const stylePath = path.join(dir, `${leaf}.styles.ts`);
            const styleCode = `import { SystemStyleObject } from "@chakra-ui/react";

export const ${leaf}Styles: SystemStyleObject = {
  container: {
    py: 6,
  },
  heading: {
    size: "md",
  },
  text: {
    mt: 2,
  },
};
`;
            await writeIfAbsent(stylePath, styleCode, !!opts.force);
          } else if (fw === "tailwind" || config.useTailwind) {
            // Tailwind detected - skip CSS Module creation (even with --with-style)
            if (program.opts().verbose) {
              console.log(
                `ℹ️  Tailwind detected — skipping CSS module creation. Use utility classes instead.`
              );
            }
          } else {
            // Basic CSS module when neither Chakra nor Tailwind is enabled
            const stylePath = path.join(dir, `${leaf}.module.css`);
            const styleCode = `.container {
  padding: 1.5rem;
}

.heading {
  font-size: 1.25rem;
  font-weight: 600;
}

.text {
  margin-top: 0.5rem;
  color: rgb(107, 114, 128);
}
`;
            await writeIfAbsent(stylePath, styleCode, !!opts.force);
          }
        }

        if (opts.withStory) {
          const storyPath = path.join(dir, `${leaf}.stories.tsx`);
          const title = [`components`, kind, leaf].join("/");
          const storyCode = `import type { Meta, StoryObj } from "@storybook/react";
import ${leaf} from "./${leaf}";

const meta = { title: "${title}", component: ${leaf} } satisfies Meta<typeof ${leaf}>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: {} };
`;
          await writeIfAbsent(storyPath, storyCode, !!opts.force);
        }

        const componentDir = path.relative(process.cwd(), path.dirname(componentPath));
        console.log(`✅ Created component ${leaf} in ${componentDir}`);

        // === Barrel update (per-kind re-exports) ===
        try {
          const barrelEnabled = (config as Record<string, unknown>).barrelExports !== false;
          if (barrelEnabled) {
            const kindIndexPath = path.join(baseDir, "components", kind, "index.ts");
            const before = await readIfExists(kindIndexPath);
            await appendExportIfMissing(kindIndexPath, componentPath, leaf);
            await sortBarrel(kindIndexPath);
            const wasCreated = before === "";
            if (program.opts().verbose) {
              console.log(
                `ℹ️  ${wasCreated ? "Created" : "Updated"} barrel: ${path.relative(process.cwd(), kindIndexPath)}`
              );
            } else {
              console.log(
                `${wasCreated ? "Created" : "Updated"} barrel: components/${kind}/index.ts`
              );
            }
          }
        } catch (err) {
          console.warn("Barrel update skipped:", err instanceof Error ? err.message : String(err));
        }

        // === Manifest update (atomic write with uniqueness) ===
        try {
          const manifestPath = path.resolve(process.cwd(), MANIFEST_PATH);
          let manifest: { components: Record<string, string[]> } = { components: {} };
          try {
            const raw = await fs.readFile(manifestPath, "utf8");
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") {
              manifest = { components: { ...(parsed.components || {}) } };
            }
          } catch {
            // will create fresh manifest
          }

          // Use Set to maintain uniqueness per group (stores component name, not path)
          const list = new Set(manifest.components[kind] ?? []);
          list.add(leaf);
          manifest.components[kind] = [...list].sort((a, b) => a.localeCompare(b));

          // Atomic write: write to temp file then rename
          await fs.mkdir(path.dirname(manifestPath), { recursive: true });
          const tmpPath = manifestPath + ".tmp";
          await fs.writeFile(tmpPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
          await fs.rename(tmpPath, manifestPath);
          if (program.opts().verbose) {
            console.log(`ℹ️  Updated manifest: added ${leaf} to ${kind} group`);
          }
          console.log("Updated .nextforge/manifest.json");
        } catch (err) {
          console.warn(
            "Manifest update skipped:",
            err instanceof Error ? err.message : String(err)
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`add:component failed: ${msg}`);
        process.exitCode = 1;
        // Rethrow so tests can catch the error
        throw err;
      }
    });
}
