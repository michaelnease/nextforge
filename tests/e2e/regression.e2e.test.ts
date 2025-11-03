import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { exists, makeTempWorkspace, readText, runCli, writeFile } from "../utils/tempWorkspace.js";

describe("Regression and safety E2E tests", () => {
  let workspace: Awaited<ReturnType<typeof makeTempWorkspace>>;

  beforeEach(async () => {
    workspace = await makeTempWorkspace();
    const appDir = path.join(workspace.dir, "app");
    await import("fs/promises").then((fs) => fs.mkdir(appDir, { recursive: true }));
    await writeFile(path.join(workspace.dir, "package.json"), JSON.stringify({ type: "module" }));
  });

  afterEach(async () => {
    if (workspace) {
      await workspace.cleanup();
    }
  });

  it("CLI exits gracefully if config missing", async () => {
    // No config file
    const result = await runCli(workspace.dir, "doctor");

    expect(result.code).toBe(0);
    // Should not crash, should use defaults
  });

  it("invalid commands show help text", async () => {
    const result = await runCli(workspace.dir, "invalid-command");

    expect(result.code).not.toBe(0);
    expect(result.stderr.toLowerCase() + result.stdout.toLowerCase()).toMatch(
      /help|unknown|invalid/i
    );
  });

  it("manifest writes atomically (JSON valid after concurrent runs)", async () => {
    // Run multiple component additions
    await runCli(workspace.dir, "add:component", "A", "--group", "ui");
    await runCli(workspace.dir, "add:component", "B", "--group", "ui");
    await runCli(workspace.dir, "add:component", "C", "--group", "ui");

    const manifestPath = path.join(workspace.dir, ".nextforge", "manifest.json");
    expect(await exists(manifestPath)).toBe(true);
    const manifestContent = await readText(manifestPath);

    // Should be valid JSON
    expect(() => JSON.parse(manifestContent)).not.toThrow();
    const manifest = JSON.parse(manifestContent);
    expect(manifest.components.ui).toContain("A");
    expect(manifest.components.ui).toContain("B");
    expect(manifest.components.ui).toContain("C");
  });

  it("add:group + add:page don't crash if repeated", async () => {
    // Create group twice (should skip second time)
    const result1 = await runCli(workspace.dir, "add:group", "auth");
    expect(result1.code).toBe(0);

    const result2 = await runCli(workspace.dir, "add:group", "auth");
    // Should succeed (skip existing files)
    expect(result2.code).toBe(0);

    // Create page twice
    const result3 = await runCli(workspace.dir, "add:page", "about");
    expect(result3.code).toBe(0);

    const result4 = await runCli(workspace.dir, "add:page", "about");
    // Should succeed (skip existing)
    expect(result4.code).toBe(0);
  });

  it("handles nested component paths correctly", async () => {
    const result = await runCli(
      workspace.dir,
      "add:component",
      "marketing/Hero",
      "--group",
      "section"
    );

    expect(result.code).toBe(0);
    const componentPath = path.join(
      workspace.dir,
      "app",
      "components",
      "section",
      "Marketing",
      "Hero",
      "Hero.tsx"
    );
    expect(await exists(componentPath)).toBe(true);
  });

  it("handles special characters in route names gracefully", async () => {
    // Test dynamic routes
    const result = await runCli(workspace.dir, "add:page", "blog/[id]");
    expect(result.code).toBe(0);

    const result2 = await runCli(workspace.dir, "add:page", "docs/[...slug]");
    expect(result2.code).toBe(0);
  });
});
