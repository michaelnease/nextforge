import fs from "node:fs/promises";
import path from "node:path";

import type { Command } from "commander";

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

function headerClient(isClient: boolean) {
  return isClient ? '"use client"\n\n' : "";
}

// ---- Minimal templates (Phase 2: no Tailwind/Chakra yet) ----
function tplBasic(name: string, isClient: boolean) {
  const hdr = headerClient(isClient);
  return `${hdr}import React from "react";

export interface ${name}Props {
  title?: string;
}

export default function ${name}({ title }: ${name}Props) {
  return (
    <section>
      <h2>${name}</h2>
      {title ? <p>{title}</p> : null}
    </section>
  );
}
`;
}

function tplLayout(name: string, isClient: boolean) {
  const hdr = headerClient(isClient);
  return `${hdr}import React, { type ReactNode } from "react";

export interface ${name}Props {
  children: ReactNode;
}

export default function ${name}({ children }: ${name}Props) {
  return <div>{children}</div>;
}
`;
}

function createTemplate(kind: Kind, name: string, isClient: boolean) {
  return kind === "layout" ? tplLayout(name, isClient) : tplBasic(name, isClient);
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
    .option("--client", "Mark as a client component", false)
    .option("--with-test", "Create a basic test file", false)
    .option("--with-story", "Create a Storybook story file", false)
    .option("--force", "Overwrite existing files", false)
    .action(async (name, opts) => {
      try {
        const kind = String(opts.kind);
        assertKind(kind as string);

        const parts = String(name).split("/").filter(Boolean);
        const leaf = pascalCase(parts.pop()!);
        const subdirs = parts.map(pascalCase);

        const baseDir = path.resolve(process.cwd(), opts.app);
        const dir = path.join(baseDir, "components", kind, ...subdirs, leaf);

        await ensureDir(dir);

        const componentPath = path.join(dir, `${leaf}.tsx`);
        const indexPath = path.join(dir, "index.ts");

        const componentCode = createTemplate(kind as Kind, leaf, Boolean(opts.client));
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
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`add:component failed: ${msg}`);
        process.exitCode = 1;
      }
    });
}
