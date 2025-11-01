import fs from "node:fs/promises";

import { Command } from "commander";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { makeTempWorkspace, readTree, readText } from "../tests/utils/tempWorkspace.js";

import { registerAddComponent } from "./commands/add/component.js";

async function runCLI(args: string[]) {
  const program = new Command().name("nextforge");
  registerAddComponent(program);
  // Configure to throw errors instead of exiting
  program.exitOverride();
  // Suppress output during tests
  program.configureOutput({ outputError: () => {} });
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

  it("creates Chakra component with client directive", async () => {
    await fs.mkdir("app", { recursive: true });
    await fs.writeFile(
      "nextforge.config.json",
      JSON.stringify({ useChakra: true, useTailwind: false, pagesDir: "app" }, null, 2)
    );

    await runCLI(["add:component", "Card", "--group", "ui", "--client", "--app", "app"]);

    const text = await readText("app/components/ui/Card/Card.tsx");
    expect(text.startsWith('"use client"')).toBe(true);
    expect(text).toMatch(/import { Box, Heading, Text } from "@chakra-ui\/react"/);
  });

  it("tailwind path no css module by default", async () => {
    await fs.mkdir("app", { recursive: true });
    await fs.writeFile(
      "nextforge.config.json",
      JSON.stringify({ useChakra: false, useTailwind: true, pagesDir: "app" }, null, 2)
    );

    await runCLI(["add:component", "Badge", "--group", "ui", "--with-style", "--app", "app"]);

    const cssExists = await fs
      .access("app/components/ui/Badge/Badge.module.css")
      .then(() => true)
      .catch(() => false);
    expect(cssExists).toBe(false);
  });

  it("creates CSS module when Tailwind is disabled", async () => {
    await fs.mkdir("app", { recursive: true });
    await fs.writeFile(
      "nextforge.config.json",
      JSON.stringify({ useChakra: false, useTailwind: false, pagesDir: "app" }, null, 2)
    );

    await runCLI(["add:component", "Badge", "--group", "ui", "--with-style", "--app", "app"]);

    const css = await readText("app/components/ui/Badge/Badge.module.css");
    expect(css).toContain(".container");
  });

  it("creates Chakra style file when Chakra is enabled", async () => {
    await fs.mkdir("app", { recursive: true });
    await fs.writeFile(
      "nextforge.config.json",
      JSON.stringify({ useChakra: true, useTailwind: false, pagesDir: "app" }, null, 2)
    );

    await runCLI(["add:component", "Card", "--group", "ui", "--with-style", "--app", "app"]);

    const styles = await readText("app/components/ui/Card/Card.styles.ts");
    expect(styles).toContain("SystemStyleObject");
    expect(styles).toContain("CardStyles");
  });

  it("validates invalid group", async () => {
    await fs.mkdir("app", { recursive: true });
    await fs.writeFile(
      "nextforge.config.json",
      JSON.stringify({ useTailwind: true, useChakra: false, pagesDir: "app" }, null, 2)
    );

    await expect(
      runCLI(["add:component", "Button", "--group", "invalid", "--app", "app"])
    ).rejects.toThrow(/Invalid --group/);
  });

  it("validates invalid component name starting with number", async () => {
    await fs.mkdir("app", { recursive: true });
    await fs.writeFile(
      "nextforge.config.json",
      JSON.stringify({ useTailwind: true, useChakra: false, pagesDir: "app" }, null, 2)
    );

    await expect(
      runCLI(["add:component", "123Button", "--group", "ui", "--app", "app"])
    ).rejects.toThrow(/Invalid component name/);
  });

  it("respects --force flag", async () => {
    await fs.mkdir("app", { recursive: true });
    await fs.writeFile(
      "nextforge.config.json",
      JSON.stringify({ useTailwind: true, useChakra: false, pagesDir: "app" }, null, 2)
    );

    await runCLI(["add:component", "Button", "--group", "ui", "--app", "app"]);
    const first = await readText("app/components/ui/Button/Button.tsx");

    await runCLI(["add:component", "Button", "--group", "ui", "--app", "app", "--force"]);
    const second = await readText("app/components/ui/Button/Button.tsx");

    expect(first).toBe(second); // Should be overwritten (same template)
  });

  it("creates server component by default (no client directive)", async () => {
    await fs.mkdir("app", { recursive: true });
    await fs.writeFile(
      "nextforge.config.json",
      JSON.stringify({ useTailwind: true, useChakra: false, pagesDir: "app" }, null, 2)
    );

    await runCLI(["add:component", "Button", "--group", "ui", "--app", "app"]);

    const text = await readText("app/components/ui/Button/Button.tsx");
    expect(text.startsWith('"use client"')).toBe(false);
  });

  it("creates all group types correctly", async () => {
    await fs.mkdir("app", { recursive: true });
    await fs.writeFile(
      "nextforge.config.json",
      JSON.stringify({ useTailwind: true, useChakra: false, pagesDir: "app" }, null, 2)
    );

    for (const group of ["ui", "layout", "section", "feature"]) {
      await runCLI(["add:component", `Test${group}`, "--group", group, "--app", "app"]);
      const exists = await fs
        .access(`app/components/${group}/Test${group}/Test${group}.tsx`)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    }
  });

  it("handles missing app directory", async () => {
    await fs.writeFile(
      "nextforge.config.json",
      JSON.stringify({ useTailwind: true, useChakra: false, pagesDir: "missing/app" }, null, 2)
    );

    await expect(
      runCLI(["add:component", "Button", "--group", "ui", "--app", "app"])
    ).rejects.toThrow(/App directory not found/);
  });
});
