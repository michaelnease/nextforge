import { join } from "node:path";

import { Command } from "commander";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { makeTempWorkspace, readText } from "../utils/tempWorkspace.js";

import { registerAddGroup } from "../../src/commands/add/group.js";

async function runCLI(args: string[]) {
  const program = new Command().name("nextforge").option("--verbose", "Enable verbose logs", false);
  registerAddGroup(program);
  // Configure to throw errors instead of exiting
  program.exitOverride();
  // Suppress output during tests
  program.configureOutput({ outputError: () => {} });
  await program.parseAsync(args, { from: "user" });
}

async function exists(filePath: string): Promise<boolean> {
  try {
    const { access } = await import("node:fs/promises");
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

describe("add:group", () => {
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

  it("auto-creates missing --app dir and scaffolds group", async () => {
    const appDir = join(ws.dir, "apps/web/app"); // does not exist

    await runCLI(["add:group", "dashboard", "--app", appDir, "--pages", "overview,settings"]);

    // Verify directory created and files exist
    await expect(exists(join(appDir, "(dashboard)"))).resolves.toBe(true);
    const page = await readText(join(appDir, "(dashboard)", "overview", "page.tsx"));
    expect(page).toMatch(/export default/);
  });

  it("refuses unsafe paths", async () => {
    // Pass raw path with .. to test traversal protection
    const bad = "apps/../web/app";
    await expect(runCLI(["add:group", "x", "--app", bad])).rejects.toThrow(
      /Refusing to create unsafe app directory/
    );
  });

  it("creates test files with --with-tests flag", async () => {
    const appDir = join(ws.dir, "app");

    await runCLI([
      "add:group",
      "reports",
      "--app",
      appDir,
      "--pages",
      "summary,detail",
      "--with-tests",
    ]);

    // Verify test files exist
    const summaryTest = join(appDir, "(reports)", "summary", "page.test.tsx");
    const detailTest = join(appDir, "(reports)", "detail", "page.test.tsx");

    await expect(exists(summaryTest)).resolves.toBe(true);
    await expect(exists(detailTest)).resolves.toBe(true);

    // Verify test file content
    const testContent = await readText(summaryTest);
    expect(testContent).toContain('import { render } from "@testing-library/react"');
    expect(testContent).toContain('import Page from "./page"');
    expect(testContent).toContain('test("renders",');
  });

  it("creates correct structure for single page with layout (index page)", async () => {
    const appDir = join(ws.dir, "app");

    await runCLI(["add:group", "account", "--app", appDir, "--pages", "index", "--with-layout"]);

    // Verify structure
    const layoutPath = join(appDir, "(account)", "layout.tsx");
    const indexPagePath = join(appDir, "(account)", "index", "page.tsx");
    const readmePath = join(appDir, "(account)", "README.md");

    await expect(exists(layoutPath)).resolves.toBe(true);
    await expect(exists(indexPagePath)).resolves.toBe(true);
    await expect(exists(readmePath)).resolves.toBe(true);

    // Verify layout content
    const layout = await readText(layoutPath);
    expect(layout).toMatch(/export default/);

    // Verify page content
    const page = await readText(indexPagePath);
    expect(page).toContain("index");
  });

  it("does not duplicate README when creating group with layout", async () => {
    const appDir = join(ws.dir, "app");

    await runCLI([
      "add:group",
      "account",
      "--app",
      appDir,
      "--pages",
      "settings,profile",
      "--with-layout",
    ]);

    // Count README files
    const { readdir } = await import("node:fs/promises");
    const files = await readdir(join(appDir, "(account)"));
    const readmeCount = files.filter((f) => f === "README.md").length;

    // Should have exactly one README
    expect(readmeCount).toBe(1);
  });
});
