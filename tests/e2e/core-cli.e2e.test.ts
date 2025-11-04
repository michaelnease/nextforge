import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { exists, makeTempWorkspace, readText, runCli, writeJson } from "../utils/tempWorkspace.js";

describe("Core CLI smoke tests", () => {
  let workspace: Awaited<ReturnType<typeof makeTempWorkspace>>;

  afterEach(async () => {
    if (workspace) {
      await workspace.cleanup();
    }
  });

  it("--help exits with code 0 and shows add:page", async () => {
    workspace = await makeTempWorkspace();
    const result = await runCli(workspace.dir, "--help");

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("add:page");
    expect(result.stderr).not.toContain("[MODULE_TYPELESS_PACKAGE_JSON]");
  });

  it("--version prints a semver string", async () => {
    workspace = await makeTempWorkspace();
    const result = await runCli(workspace.dir, "--version");

    expect(result.code).toBe(0);
    // Version should match semver pattern (e.g., 0.1.0)
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("doctor prints 'Doctor running' or similar", async () => {
    workspace = await makeTempWorkspace();
    const result = await runCli(workspace.dir, "doctor");

    // Exit code 0 = all pass, 1 = warnings (acceptable), 2 = failures (not acceptable)
    expect(result.code).toBeLessThanOrEqual(1);
    // Doctor command outputs report to stdout
    const output = (result.stdout + result.stderr).toLowerCase();
    expect(output).toMatch(/doctor/i);
    expect(output).toMatch(/report|check|node\.js|next\.js/i);
  });

  it("init creates nextforge config in temp workspace", async () => {
    workspace = await makeTempWorkspace();
    // Create a minimal package.json to trigger .mjs creation
    await writeJson(path.join(workspace.dir, "package.json"), {
      name: "test",
      type: "module",
    });
    const result = await runCli(workspace.dir, "init", "--yes");

    expect(result.code).toBe(0);
    const configPath = path.join(workspace.dir, "nextforge.config.mjs");
    expect(await exists(configPath)).toBe(true);

    const content = await readText(configPath);
    expect(content).toContain("useTailwind");
    expect(content).toContain("appDir");
  });

  it("no Node warnings about MODULE_TYPELESS_PACKAGE_JSON appear in stderr", async () => {
    workspace = await makeTempWorkspace();
    const result = await runCli(workspace.dir, "--help");

    expect(result.code).toBe(0);
    expect(result.stderr).not.toContain("[MODULE_TYPELESS_PACKAGE_JSON]");
  });
});
