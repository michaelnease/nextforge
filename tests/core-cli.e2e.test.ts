import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { exists, makeTempWorkspace, readText, runCli } from "./utils/tempWorkspace.js";

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

    expect(result.code).toBe(0);
    // Doctor command uses ora spinner which outputs to stderr or stdout
    const output = (result.stdout + result.stderr).toLowerCase();
    expect(output).toMatch(/doctor.*running/i);
  });

  it("init creates nextforge.config.ts in temp workspace", async () => {
    workspace = await makeTempWorkspace();
    const result = await runCli(workspace.dir, "init");

    expect(result.code).toBe(0);
    const configPath = path.join(workspace.dir, "nextforge.config.ts");
    expect(await exists(configPath)).toBe(true);

    const content = await readText(configPath);
    expect(content).toContain("useTailwind");
    expect(content).toContain("pagesDir");
  });

  it("no Node warnings about MODULE_TYPELESS_PACKAGE_JSON appear in stderr", async () => {
    workspace = await makeTempWorkspace();
    const result = await runCli(workspace.dir, "--help");

    expect(result.code).toBe(0);
    expect(result.stderr).not.toContain("[MODULE_TYPELESS_PACKAGE_JSON]");
  });
});
