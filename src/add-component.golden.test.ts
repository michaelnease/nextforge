import fs from "node:fs/promises";

import { Command } from "commander";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { makeTempWorkspace, readTree, readText } from "../tests/utils/tempWorkspace.js";

import { registerAddComponent } from "./commands/add/component.js";

async function runCLI(args: string[]) {
  const program = new Command().name("nextforge");
  registerAddComponent(program);
  await program.parseAsync(args, { from: "user" });
}

describe("add:component", () => {
  let ws: { dir: string; restore: () => void };

  beforeEach(async () => {
    ws = await makeTempWorkspace();
  });
  afterEach(async () => {
    ws.restore();
  });

  it("creates a Tailwind UI component using config pagesDir", async () => {
    await fs.mkdir("src/app", { recursive: true });
    await fs.writeFile(
      "nextforge.config.json",
      JSON.stringify({ useTailwind: true, useChakra: false, pagesDir: "src/app" }, null, 2)
    );

    await runCLI(["add:component", "Button", "--group", "ui", "--app", "app"]);

    const files = await readTree(ws.dir, "src/app/components/ui/Button");
    expect(files).toEqual(["Button.tsx", "index.ts"]);

    const code = await readText("src/app/components/ui/Button/Button.tsx");
    expect(code).toContain('className="p-6"');
    expect(code).not.toContain("@chakra-ui/react");
  });

  it("respects --framework override to Chakra and updates per-kind barrel", async () => {
    await fs.mkdir("app", { recursive: true });
    await fs.writeFile(
      "nextforge.config.json",
      JSON.stringify({ useTailwind: true, useChakra: false, pagesDir: "app" }, null, 2)
    );

    await runCLI([
      "add:component",
      "Card",
      "--group",
      "ui",
      "--framework",
      "chakra",
      "--app",
      "app",
    ]);

    const code = await readText("app/components/ui/Card/Card.tsx");
    expect(code).toContain("@chakra-ui/react");

    const barrel = await readText("app/components/ui/index.ts");
    expect(barrel).toContain('export { default as Card } from "./Card/Card";');
    expect(barrel).toContain('export * from "./Card/Card";');
  });

  it("creates a Chakra layout with children and the client directive when requested", async () => {
    await fs.mkdir("app", { recursive: true });
    await fs.writeFile(
      "nextforge.config.json",
      JSON.stringify({ useTailwind: false, useChakra: true, pagesDir: "app" }, null, 2)
    );

    await runCLI(["add:component", "Shell", "--group", "layout", "--client", "--app", "app"]);

    const code = await readText("app/components/layout/Shell/Shell.tsx");
    expect(code.startsWith(`"use client"`)).toBe(true);
    expect(code).toContain("children: ReactNode");
    expect(code).toContain("Container");
  });

  it("handles nested names and avoids duplicates in barrel and manifest", async () => {
    await fs.mkdir("app", { recursive: true });
    await fs.writeFile(
      "nextforge.config.json",
      JSON.stringify({ useTailwind: true, useChakra: false, pagesDir: "app" }, null, 2)
    );

    await runCLI(["add:component", "marketing/Hero", "--group", "section", "--app", "app"]);
    await runCLI(["add:component", "marketing/Hero", "--group", "section", "--app", "app"]);

    const tree = await readTree(ws.dir, "app/components/section");
    expect(tree).toEqual([
      "Marketing/",
      "Marketing/Hero/",
      "Marketing/Hero/Hero.tsx",
      "Marketing/Hero/index.ts",
      "index.ts",
    ]);

    const barrel = await readText("app/components/section/index.ts");
    const needle = 'export { default as Hero } from "./Marketing/Hero/Hero";';
    const count = (
      barrel.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []
    ).length;
    expect(count).toBe(1);

    const manifest = JSON.parse(await readText(".nextforge/manifest.json"));
    expect(Array.isArray(manifest.components.section)).toBe(true);
  });
});
