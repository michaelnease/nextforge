import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { exists, makeTempWorkspace, readText, runCli, writeFile } from "./utils/tempWorkspace.js";

describe("add:component command E2E tests", () => {
  let workspace: Awaited<ReturnType<typeof makeTempWorkspace>>;

  beforeEach(async () => {
    workspace = await makeTempWorkspace();
    // Create app directory and package.json
    const appDir = path.join(workspace.dir, "app");
    await import("fs/promises").then((fs) => fs.mkdir(appDir, { recursive: true }));
    await writeFile(path.join(workspace.dir, "package.json"), JSON.stringify({ type: "module" }));
  });

  afterEach(async () => {
    if (workspace) {
      await workspace.cleanup();
    }
  });

  it("basic UI: add:component Button --group ui creates component + barrel export", async () => {
    const result = await runCli(workspace.dir, "add:component", "Button", "--group", "ui");

    expect(result.code).toBe(0);
    const componentPath = path.join(
      workspace.dir,
      "app",
      "components",
      "ui",
      "Button",
      "Button.tsx"
    );
    expect(await exists(componentPath)).toBe(true);
    const indexPath = path.join(workspace.dir, "app", "components", "ui", "index.ts");
    expect(await exists(indexPath)).toBe(true);
    const barrelContent = await readText(indexPath);
    expect(barrelContent).toContain("export");
    expect(barrelContent).toContain("Button");
  });

  it("layout: add:component Shell --group layout accepts children", async () => {
    const result = await runCli(workspace.dir, "add:component", "Shell", "--group", "layout");

    expect(result.code).toBe(0);
    const componentPath = path.join(
      workspace.dir,
      "app",
      "components",
      "layout",
      "Shell",
      "Shell.tsx"
    );
    expect(await exists(componentPath)).toBe(true);
    const content = await readText(componentPath);
    expect(content).toContain("children");
  });

  it("section: add:component Hero --group section creates component", async () => {
    const result = await runCli(workspace.dir, "add:component", "Hero", "--group", "section");

    expect(result.code).toBe(0);
    const componentPath = path.join(
      workspace.dir,
      "app",
      "components",
      "section",
      "Hero",
      "Hero.tsx"
    );
    expect(await exists(componentPath)).toBe(true);
  });

  it("feature: add:component Auth --group feature --with-tests --with-style --client has test + style + 'use client'", async () => {
    const result = await runCli(
      workspace.dir,
      "add:component",
      "Auth",
      "--group",
      "feature",
      "--with-tests",
      "--with-style",
      "--client",
      "--framework",
      "basic"
    );

    expect(result.code).toBe(0);
    const componentPath = path.join(
      workspace.dir,
      "app",
      "components",
      "feature",
      "Auth",
      "Auth.tsx"
    );
    expect(await exists(componentPath)).toBe(true);
    const content = await readText(componentPath);
    expect(content).toMatch(/^"use client"/m);

    const testPath = path.join(
      workspace.dir,
      "app",
      "components",
      "feature",
      "Auth",
      "Auth.test.tsx"
    );
    expect(await exists(testPath)).toBe(true);

    // For basic (no Tailwind/Chakra), should create CSS module
    const stylePath = path.join(
      workspace.dir,
      "app",
      "components",
      "feature",
      "Auth",
      "Auth.module.css"
    );
    expect(await exists(stylePath)).toBe(true);
  });

  it("Tailwind: add:component Badge --framework tailwind --with-style does not create CSS module", async () => {
    const result = await runCli(
      workspace.dir,
      "add:component",
      "Badge",
      "--framework",
      "tailwind",
      "--with-style"
    );

    expect(result.code).toBe(0);
    const componentPath = path.join(workspace.dir, "app", "components", "ui", "Badge", "Badge.tsx");
    expect(await exists(componentPath)).toBe(true);
    const content = await readText(componentPath);
    expect(content).toContain("className");

    // Tailwind should not create CSS module
    const cssModulePath = path.join(
      workspace.dir,
      "app",
      "components",
      "ui",
      "Badge",
      "Badge.module.css"
    );
    expect(await exists(cssModulePath)).toBe(false);
  });

  it("Chakra: add:component Card --framework chakra --with-style creates .styles.ts", async () => {
    const result = await runCli(
      workspace.dir,
      "add:component",
      "Card",
      "--framework",
      "chakra",
      "--with-style"
    );

    expect(result.code).toBe(0);
    const stylePath = path.join(workspace.dir, "app", "components", "ui", "Card", "Card.styles.ts");
    expect(await exists(stylePath)).toBe(true);
    const content = await readText(stylePath);
    expect(content).toContain("SystemStyleObject");
  });

  it("both frameworks: add:component Hybrid --framework both creates hybrid component", async () => {
    const result = await runCli(workspace.dir, "add:component", "Hybrid", "--framework", "both");

    expect(result.code).toBe(0);
    const componentPath = path.join(
      workspace.dir,
      "app",
      "components",
      "ui",
      "Hybrid",
      "Hybrid.tsx"
    );
    expect(await exists(componentPath)).toBe(true);
    const content = await readText(componentPath);
    expect(content).toContain("@chakra-ui/react");
    expect(content).toContain("className");
  });

  it("force overwrite: add:component Button --force succeeds twice", async () => {
    await runCli(workspace.dir, "add:component", "Button", "--force");
    const result = await runCli(workspace.dir, "add:component", "Button", "--force");

    expect(result.code).toBe(0);
  });

  it("manifest correctness: .nextforge/manifest.json lists created components uniquely", async () => {
    await runCli(workspace.dir, "add:component", "Button", "--group", "ui");
    await runCli(workspace.dir, "add:component", "Card", "--group", "ui");

    const manifestPath = path.join(workspace.dir, ".nextforge", "manifest.json");
    expect(await exists(manifestPath)).toBe(true);
    const manifestContent = await readText(manifestPath);
    const manifest = JSON.parse(manifestContent);

    expect(manifest.components).toBeDefined();
    expect(manifest.components.ui).toContain("Button");
    expect(manifest.components.ui).toContain("Card");
    // Should not have duplicates
    const buttonCount = manifest.components.ui.filter((c: string) => c === "Button").length;
    expect(buttonCount).toBe(1);
  });

  it("barrel idempotency: re-running doesn't duplicate exports", async () => {
    await runCli(workspace.dir, "add:component", "Button", "--group", "ui");
    const indexPath = path.join(workspace.dir, "app", "components", "ui", "index.ts");
    const firstRun = await readText(indexPath);
    const exportLines1 = firstRun.split("\n").filter((l) => l.includes("export"));

    // Run again (should skip due to file existing)
    await runCli(workspace.dir, "add:component", "Button", "--group", "ui");
    const secondRun = await readText(indexPath);
    const exportLines2 = secondRun.split("\n").filter((l) => l.includes("export"));

    // Should have same number of exports
    expect(exportLines1.length).toBe(exportLines2.length);
  });
});
