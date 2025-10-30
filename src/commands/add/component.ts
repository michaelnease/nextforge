// Intentionally unused import kept for possible future synchronous checks
// import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import type { Command } from "commander";

import { loadConfig } from "../../utils/loadConfig.js";
import { mergeConfig } from "../../utils/mergeConfig.js";

const MANIFEST_PATH = ".nextforge/manifest.json";

type Kind = "ui" | "layout" | "section" | "feature";

function pascalCase(s: string) {
  return s
    .replace(/[/\s_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
}
async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeFileSafe(file: string, contents: string, force: boolean) {
  try {
    if (!force) {
      await fs.access(file);
      return; // already exists; skip
    }
  } catch {
    // file does not exist; proceed to write
  }
  await fs.writeFile(file, contents, "utf8");
}

function withClientHeader(code: string, isClient: boolean) {
  return isClient ? `"use client"\n\n` + code : code;
}

function pascalProps(name: string) {
  return `${name}Props`;
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

function assertKind(k: string): asserts k is Kind {
  if (!["ui", "layout", "section", "feature"].includes(k)) {
    throw new Error(`Invalid --kind "${k}". Use ui, layout, section, or feature.`);
  }
}

export function registerAddComponent(program: Command) {
  program
    .command("add:component")
    .description("Create a component in <app>/components/<kind>/<Name>")
    .argument("<name>", "Component name, e.g. Button or marketing/Hero")
    .requiredOption("--kind <kind>", "ui | layout | section | feature")
    .option("--app <dir>", "App directory (default: app)", "app")
    .option("--framework <name>", "Override template: chakra | tailwind | basic | both")
    .option("--client", "Mark as a client component", false)
    .option("--with-test", "Create a basic test file", false)
    .option("--with-story", "Create a Storybook story file", false)
    .option("--force", "Overwrite existing files", false)
    .action(async (name, opts) => {
      try {
        const kind = String(opts.kind);
        assertKind(kind as string);

        const parts = String(name)
          .split("/")
          .map((s) => s.trim())
          .filter(Boolean);
        if (parts.some((p) => p === "." || p === "..")) {
          throw new Error("Component path cannot contain '.' or '..'.");
        }
        if (parts.some((p) => /[^a-z0-9-_]/i.test(p))) {
          throw new Error(`Invalid characters in component path: ${parts.join("/")}`);
        }
        const leaf = pascalCase(parts.pop()!);
        const subdirs = parts.map(pascalCase);

        const fileCfg = await loadConfig({ verbose: Boolean(program.opts().verbose) });
        const fw = (opts.framework ?? "").toString().toLowerCase().trim();
        const validFrameworks = new Set([
          "",
          "chakra",
          "tailwind",
          "basic",
          "both",
          "chakra+tailwind",
          "tailwind+chakra",
        ]);
        if (!validFrameworks.has(fw)) {
          throw new Error(`Invalid --framework "${fw}". Use chakra | tailwind | basic | both.`);
        }
        const fwOverride =
          fw === "chakra"
            ? { useChakra: true, useTailwind: false }
            : fw === "tailwind"
              ? { useChakra: false, useTailwind: true }
              : fw === "basic"
                ? { useChakra: false, useTailwind: false }
                : fw === "both" || fw === "chakra+tailwind" || fw === "tailwind+chakra"
                  ? { useChakra: true, useTailwind: true }
                  : {};
        const flagsCfg = {
          pagesDir: opts.app,
          ...fwOverride,
        } as Partial<{ pagesDir: string; useChakra: boolean; useTailwind: boolean }>;
        const config = mergeConfig({
          fileConfig: fileCfg,
          env: process.env,
          flags: flagsCfg as Partial<Record<string, unknown>>,
        });

        const baseDir = path.resolve(process.cwd(), config.pagesDir);
        const dir = path.join(baseDir, "components", kind, ...subdirs, leaf);

        await ensureDir(dir);

        const componentPath = path.join(dir, `${leaf}.tsx`);
        const indexPath = path.join(dir, "index.ts");

        const componentCode = chooseTemplate(
          kind as Kind,
          leaf,
          { useChakra: config.useChakra, useTailwind: config.useTailwind },
          Boolean(opts.client)
        );
        await writeFileSafe(componentPath, componentCode, Boolean(opts.force));

        const indexCode = `export { default } from "./${leaf}";\nexport * from "./${leaf}";\n`;
        await writeFileSafe(indexPath, indexCode, Boolean(opts.force));

        if (kind === "feature") {
          const hookPath = path.join(dir, `use${leaf}.ts`);
          const hookCode = `import { useState } from "react";
export function use${leaf}() {
  const [state, setState] = useState({});
  return { state, setState };
}
`;
          await writeFileSafe(hookPath, hookCode, Boolean(opts.force));
        }

        if (opts.withTest) {
          const testPath = path.join(dir, `${leaf}.test.tsx`);
          const testCode = `import { describe, it, expect } from "vitest";
import ${leaf} from "./${leaf}";
describe("${leaf}", () => {
  it("is defined", () => { expect(${leaf}).toBeDefined(); });
});
`;
          await writeFileSafe(testPath, testCode, Boolean(opts.force));
        }

        if (opts.withStory) {
          const storyPath = path.join(dir, `${leaf}.stories.tsx`);
          const storyCode = `import type { Meta, StoryObj } from "@storybook/react";
import ${leaf} from "./${leaf}";
const meta: Meta<typeof ${leaf}> = { title: "components/${kind}/${leaf}", component: ${leaf} };
export default meta;
export const Primary: StoryObj<typeof ${leaf}> = { args: {} };
`;
          await writeFileSafe(storyPath, storyCode, Boolean(opts.force));
        }

        const rel = path.relative(process.cwd(), dir) || dir;
        console.log(`Created component at ${rel}`);

        // === Barrel update ===
        try {
          const barrelDir = path.join(baseDir, "components", kind);
          const barrelPath = path.join(barrelDir, "index.ts");

          let barrelContent = "";
          try {
            barrelContent = await fs.readFile(barrelPath, "utf8");
          } catch {
            // no existing barrel
          }

          const exportLine = `export * from "./${leaf}";`;
          if (!barrelContent.includes(exportLine) || Boolean(opts.force)) {
            const lines = barrelContent.split(/\r?\n/).filter(Boolean);
            if (!lines.includes(exportLine)) lines.push(exportLine);
            lines.sort((a, b) => a.localeCompare(b));
            await fs.mkdir(barrelDir, { recursive: true });
            await fs.writeFile(barrelPath, lines.join("\n") + "\n", "utf8");
            console.log(`Updated barrel: components/${kind}/index.ts`);
          }
        } catch (err) {
          console.warn("Barrel update skipped:", err instanceof Error ? err.message : String(err));
        }

        // === Manifest update ===
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

          const section = manifest.components;
          const list = (section[kind] ||= []);
          if (!list.includes(leaf)) list.push(leaf);
          list.sort((a, b) => a.localeCompare(b));

          await fs.mkdir(path.dirname(manifestPath), { recursive: true });
          await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
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
      }
    });
}
