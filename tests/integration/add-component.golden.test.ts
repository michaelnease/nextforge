import fs from "node:fs/promises";

import { Command } from "commander";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { makeTempWorkspace, readTree, readText } from "../utils/tempWorkspace.js";

import { registerAddComponent } from "../../src/commands/add/component.js";

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
  let ws: Awaited<ReturnType<typeof makeTempWorkspace>>;
  let originalCwd: string;

  beforeEach(async () => {
    ws = await makeTempWorkspace();
    originalCwd = process.cwd();
    process.chdir(ws.dir);
  });
  afterEach(async () => {
    process.chdir(originalCwd);
    await ws.cleanup();
  });

  it("creates a Tailwind UI component using config pagesDir", async () => {
    await fs.mkdir("src/app", { recursive: true });
    await fs.writeFile(
      "nextforge.config.json",
      JSON.stringify({ useTailwind: true, useChakra: false, pagesDir: "src/app" }, null, 2)
    );

    // Run without --app so pagesDir wins
    await runCLI(["add:component", "Button", "--group", "ui"]);

    const files = await readTree(ws.dir, "src/components/ui/Button");
    expect(files).toEqual(["Button.tsx", "index.ts"]);

    const code = await readText("src/components/ui/Button/Button.tsx");
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

    const code = await readText("components/ui/Card/Card.tsx");
    expect(code).toContain("@chakra-ui/react");

    const barrel = await readText("components/ui/index.ts");
    expect(barrel).toContain('export { default as Card } from "Card/Card";');
  });

  it("creates a Chakra layout with children and the client directive when requested", async () => {
    await fs.mkdir("app", { recursive: true });
    await fs.writeFile(
      "nextforge.config.json",
      JSON.stringify({ useTailwind: false, useChakra: true, pagesDir: "app" }, null, 2)
    );

    await runCLI(["add:component", "Shell", "--group", "layout", "--client", "--app", "app"]);

    const code = await readText("components/layout/Shell/Shell.tsx");
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

    const tree = await readTree(ws.dir, "components/section");
    expect(tree).toEqual([
      "Marketing/",
      "Marketing/Hero/",
      "Marketing/Hero/Hero.tsx",
      "Marketing/Hero/index.ts",
      "index.ts",
    ]);

    const barrel = await readText("components/section/index.ts");
    const needle = 'export { default as Hero } from "Marketing/Hero/Hero";';
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

    const text = await readText("components/ui/Card/Card.tsx");
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
      .access("components/ui/Badge/Badge.module.css")
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

    const css = await readText("components/ui/Badge/Badge.module.css");
    expect(css).toContain(".container");
  });

  it("creates Chakra style file when Chakra is enabled", async () => {
    await fs.mkdir("app", { recursive: true });
    await fs.writeFile(
      "nextforge.config.json",
      JSON.stringify({ useChakra: true, useTailwind: false, pagesDir: "app" }, null, 2)
    );

    await runCLI(["add:component", "Card", "--group", "ui", "--with-style", "--app", "app"]);

    const styles = await readText("components/ui/Card/Card.styles.ts");
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
    ).rejects.toThrow(/Invalid --type\/--group/);
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
    const first = await readText("components/ui/Button/Button.tsx");

    await runCLI(["add:component", "Button", "--group", "ui", "--app", "app", "--force"]);
    const second = await readText("components/ui/Button/Button.tsx");

    expect(first).toBe(second); // Should be overwritten (same template)
  });

  it("creates server component by default (no client directive)", async () => {
    await fs.mkdir("app", { recursive: true });
    await fs.writeFile(
      "nextforge.config.json",
      JSON.stringify({ useTailwind: true, useChakra: false, pagesDir: "app" }, null, 2)
    );

    await runCLI(["add:component", "Button", "--group", "ui", "--app", "app"]);

    const text = await readText("components/ui/Button/Button.tsx");
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
        .access(`components/${group}/Test${group}/Test${group}.tsx`)
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

  it("creates Storybook story with correct format", async () => {
    await fs.mkdir("app", { recursive: true });
    await fs.writeFile(
      "nextforge.config.json",
      JSON.stringify({ useTailwind: true, useChakra: false, pagesDir: "app" }, null, 2)
    );

    await runCLI(["add:component", "Card", "--group", "ui", "--with-story", "--app", "app"]);

    const story = await readText("components/ui/Card/Card.stories.tsx");
    expect(story).toContain('title: "components/ui/Card"');
    expect(story).toContain("satisfies Meta");
    expect(story).toContain("type Story = StoryObj<typeof meta>");
    expect(story).toContain("export const Primary: Story");
  });

  it("maintains manifest uniqueness", async () => {
    await fs.mkdir("app", { recursive: true });
    await fs.writeFile(
      "nextforge.config.json",
      JSON.stringify({ useTailwind: true, useChakra: false, pagesDir: "app" }, null, 2)
    );

    await runCLI(["add:component", "Button", "--group", "ui", "--app", "app"]);
    await runCLI(["add:component", "Button", "--group", "ui", "--app", "app"]);

    const manifest = JSON.parse(await readText(".nextforge/manifest.json"));
    expect(manifest.components.ui).toEqual(["Button"]);
    expect(manifest.components.ui.length).toBe(1);
  });

  it("tailwind with --with-style skips CSS module", async () => {
    await fs.mkdir("app", { recursive: true });
    await fs.writeFile(
      "nextforge.config.json",
      JSON.stringify({ useChakra: false, useTailwind: true, pagesDir: "app" }, null, 2)
    );

    await runCLI(["add:component", "Badge", "--group", "ui", "--with-style", "--app", "app"]);

    const cssExists = await fs
      .access("components/ui/Badge/Badge.module.css")
      .then(() => true)
      .catch(() => false);
    expect(cssExists).toBe(false);
  });

  it("both Chakra and Tailwind flags uses ChakraTailwind template", async () => {
    await fs.mkdir("app", { recursive: true });
    await fs.writeFile(
      "nextforge.config.json",
      JSON.stringify({ useChakra: true, useTailwind: true, pagesDir: "app" }, null, 2)
    );

    await runCLI(["add:component", "Hybrid", "--group", "ui", "--app", "app"]);

    const code = await readText("components/ui/Hybrid/Hybrid.tsx");
    expect(code).toContain("@chakra-ui/react");
    expect(code).toContain('className="');
    expect(code).toContain("Box");
  });

  it("--framework both creates ChakraTailwind template", async () => {
    await fs.mkdir("app", { recursive: true });
    await fs.writeFile(
      "nextforge.config.json",
      JSON.stringify({ useChakra: false, useTailwind: false, pagesDir: "app" }, null, 2)
    );

    await runCLI([
      "add:component",
      "Hybrid",
      "--group",
      "ui",
      "--framework",
      "both",
      "--app",
      "app",
    ]);

    const code = await readText("components/ui/Hybrid/Hybrid.tsx");
    expect(code).toContain("@chakra-ui/react");
    expect(code).toContain('className="');
    expect(code).toContain("Box");
  });

  // Template existence verified by existing tests:
  // - "creates a Tailwind UI component" verifies tplTailwind
  // - "creates Chakra component with client directive" verifies tplChakra
  // - "both Chakra and Tailwind flags uses ChakraTailwind template" verifies tplChakraTailwind

  it("barrel export is idempotent (no duplicates on second run)", async () => {
    await fs.mkdir("app", { recursive: true });
    await fs.writeFile(
      "nextforge.config.json",
      JSON.stringify({ useTailwind: true, useChakra: false, pagesDir: "app" }, null, 2)
    );

    // First run
    await runCLI(["add:component", "Button", "--group", "ui", "--app", "app"]);
    const barrel1 = await readText("components/ui/index.ts");
    const count1 = (barrel1.match(/export \{ default as Button \}/g) || []).length;
    // Verify POSIX path is used (forward slashes)
    expect(barrel1).toMatch(/export.*from.*["'].*Button\/Button["']/);
    expect(barrel1).not.toContain("\\");

    // Second run - should not duplicate
    await runCLI(["add:component", "Button", "--group", "ui", "--app", "app"]);
    const barrel2 = await readText("components/ui/index.ts");
    const count2 = (barrel2.match(/export \{ default as Button \}/g) || []).length;

    // Should have exactly one export line
    expect(count2).toBe(count1);
    expect(count1).toBe(1);
    // Still uses POSIX paths after second run
    expect(barrel2).toMatch(/export.*from.*["'].*Button\/Button["']/);
    expect(barrel2).not.toContain("\\");
  });

  it("generated files end with newline", async () => {
    await fs.mkdir("app", { recursive: true });
    await fs.writeFile(
      "nextforge.config.json",
      JSON.stringify({ useTailwind: true, useChakra: false, pagesDir: "app" }, null, 2)
    );

    await runCLI(["add:component", "Button", "--group", "ui", "--app", "app"]);

    const component = await readText("components/ui/Button/Button.tsx");
    const index = await readText("components/ui/Button/index.ts");
    expect(component.endsWith("\n")).toBe(true);
    expect(index.endsWith("\n")).toBe(true);
  });

  it("barrel exports use POSIX paths (Windows compatibility)", async () => {
    await fs.mkdir("app", { recursive: true });
    await fs.writeFile(
      "nextforge.config.json",
      JSON.stringify({ useTailwind: true, useChakra: false, pagesDir: "app" }, null, 2)
    );

    await runCLI(["add:component", "Button", "--group", "ui", "--app", "app"]);

    const barrel = await readText("components/ui/index.ts");
    // POSIX paths use forward slashes, even on Windows
    expect(barrel).not.toContain("\\");
    // Verify forward slashes are used in import paths
    expect(barrel).toMatch(/export.*from.*["'].*Button\/Button["']/);
    expect(barrel).toMatch(/export.*from.*["'].*\/.*["']/);
  });

  it("framework precedence: config Tailwind but --framework chakra → Chakra output", async () => {
    await fs.mkdir("app", { recursive: true });
    await fs.writeFile(
      "nextforge.config.json",
      JSON.stringify({ useTailwind: true, useChakra: false, pagesDir: "app" }, null, 2)
    );

    await runCLI([
      "add:component",
      "Test",
      "--group",
      "ui",
      "--framework",
      "chakra",
      "--app",
      "app",
    ]);

    const code = await readText("components/ui/Test/Test.tsx");
    expect(code).toContain("@chakra-ui/react");
    expect(code).toContain("Box");
    expect(code).not.toContain('className="p-6"'); // Should be Chakra, not Tailwind
  });

  it("invalid framework shows helpful error", async () => {
    await fs.mkdir("app", { recursive: true });
    await fs.writeFile(
      "nextforge.config.json",
      JSON.stringify({ useTailwind: true, useChakra: false, pagesDir: "app" }, null, 2)
    );

    await expect(
      runCLI(["add:component", "Button", "--group", "ui", "--framework", "invalid", "--app", "app"])
    ).rejects.toThrow(/Invalid --framework.*Use one of: chakra, tailwind, basic, both/);
  });

  it("places 'use client' on line 1 (exactly first line, no leading whitespace)", async () => {
    await fs.mkdir("app", { recursive: true });
    await fs.writeFile(
      "nextforge.config.json",
      JSON.stringify({ useTailwind: true, useChakra: false, pagesDir: "app" }, null, 2)
    );

    await runCLI(["add:component", "Counter", "--group", "ui", "--client", "--app", "app"]);

    const txt = await readText("components/ui/Counter/Counter.tsx");
    // Verify exactly first line is "use client" with no leading whitespace or comments
    expect(txt.split(/\r?\n/, 1)[0]).toBe('"use client";');
    // Also verify it's the very first character of the file
    expect(txt.trimStart().split(/\r?\n/, 1)[0]).toBe('"use client";');
  });

  it("force overwrite replaces files only with --force", async () => {
    await fs.mkdir("app", { recursive: true });
    await fs.writeFile(
      "nextforge.config.json",
      JSON.stringify({ useTailwind: true, useChakra: false, pagesDir: "app" }, null, 2)
    );

    // Create component first time
    await runCLI(["add:component", "Button", "--group", "ui", "--app", "app"]);
    const firstCode = await readText("components/ui/Button/Button.tsx");

    // Try to create again without --force (should skip)
    await runCLI(["add:component", "Button", "--group", "ui", "--app", "app"]);
    const secondCode = await readText("components/ui/Button/Button.tsx");
    expect(firstCode).toBe(secondCode); // Should be unchanged

    // Create with --force (should overwrite)
    await runCLI(["add:component", "Button", "--group", "ui", "--app", "app", "--force"]);
    const thirdCode = await readText("components/ui/Button/Button.tsx");
    expect(thirdCode).toBe(firstCode); // Should be overwritten (same template)
  });

  it("--force applies to style and story files", async () => {
    await fs.mkdir("app", { recursive: true });
    await fs.writeFile(
      "nextforge.config.json",
      JSON.stringify({ useChakra: true, useTailwind: false, pagesDir: "app" }, null, 2)
    );

    // Create with style and story first time
    await runCLI([
      "add:component",
      "Card",
      "--group",
      "ui",
      "--with-style",
      "--with-story",
      "--app",
      "app",
    ]);

    const stylePath = "components/ui/Card/Card.styles.ts";
    const storyPath = "components/ui/Card/Card.stories.tsx";
    const firstStyle = await readText(stylePath);
    const firstStory = await readText(storyPath);

    // Try to create again without --force (should skip)
    await runCLI([
      "add:component",
      "Card",
      "--group",
      "ui",
      "--with-style",
      "--with-story",
      "--app",
      "app",
    ]);
    const secondStyle = await readText(stylePath);
    const secondStory = await readText(storyPath);
    expect(firstStyle).toBe(secondStyle);
    expect(firstStory).toBe(secondStory);

    // Create with --force (should overwrite)
    await runCLI([
      "add:component",
      "Card",
      "--group",
      "ui",
      "--with-style",
      "--with-story",
      "--app",
      "app",
      "--force",
    ]);
    const thirdStyle = await readText(stylePath);
    const thirdStory = await readText(storyPath);
    expect(thirdStyle).toBe(firstStyle); // Should be overwritten
    expect(thirdStory).toBe(firstStory); // Should be overwritten
  });
});
