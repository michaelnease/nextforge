import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  exists,
  makeTempWorkspace,
  readText,
  runCli,
  writeFile,
  writeJson,
} from "../utils/tempWorkspace.js";

describe("nextforge init e2e", () => {
  let workspace: Awaited<ReturnType<typeof makeTempWorkspace>> | null = null;

  afterEach(async () => {
    if (workspace) {
      await workspace.cleanup();
      workspace = null;
    }
  });

  it("creates .mjs when JS ESM project", async () => {
    workspace = await makeTempWorkspace();
    await writeJson(path.join(workspace.dir, "package.json"), {
      name: "tmp",
      type: "module",
    });

    const res = await runCli(workspace.dir, "init", "--yes");
    expect(res.code).toBe(0);
    expect(res.stdout).toContain("Created nextforge.config.mjs");

    const configPath = path.join(workspace.dir, "nextforge.config.mjs");
    const configExists = await exists(configPath);
    expect(configExists).toBe(true);

    const file = await readText(configPath);
    expect(file).toContain("export default");
    expect(file).toContain("appDir:");
    expect(file).toContain("useTailwind:");
  });

  it("creates .js when CommonJS project", async () => {
    workspace = await makeTempWorkspace();
    await writeJson(path.join(workspace.dir, "package.json"), {
      name: "tmp",
      // No "type": "module" = CommonJS
    });

    const res = await runCli(workspace.dir, "init", "--yes");
    expect(res.code).toBe(0);
    expect(res.stdout).toContain("Created nextforge.config.js");

    const configPath = path.join(workspace.dir, "nextforge.config.js");
    const configExists = await exists(configPath);
    expect(configExists).toBe(true);

    const file = await readText(configPath);
    expect(file).toContain("module.exports");
  });

  it("creates .ts when TypeScript project with tsx installed", async () => {
    workspace = await makeTempWorkspace();
    await writeJson(path.join(workspace.dir, "package.json"), {
      name: "tmp",
      type: "module",
      devDependencies: {
        typescript: "5.0.0",
        tsx: "4.0.0",
      },
    });

    // Create a minimal node_modules structure to simulate tsx being installed
    const nodeModulesPath = path.join(workspace.dir, "node_modules", "tsx");
    await writeFile(
      path.join(nodeModulesPath, "package.json"),
      JSON.stringify({ name: "tsx", version: "4.0.0" })
    );

    const res = await runCli(workspace.dir, "init", "--yes");
    // May fail to install in temp workspace, but should still create config
    expect([0, 1]).toContain(res.code);
    expect(res.stdout).toContain("Created nextforge.config.ts");

    const configPath = path.join(workspace.dir, "nextforge.config.ts");
    const configExists = await exists(configPath);
    expect(configExists).toBe(true);

    const file = await readText(configPath);
    expect(file).toContain("export default");
  });

  it("refuses to overwrite without --force", async () => {
    workspace = await makeTempWorkspace();
    await writeJson(path.join(workspace.dir, "package.json"), {
      name: "tmp",
      type: "module",
    });
    await writeFile(path.join(workspace.dir, "nextforge.config.mjs"), "export default {}");

    const res = await runCli(workspace.dir, "init");
    expect(res.code).toBe(0);
    expect(res.stdout).toContain("Re-run with --force");
  });

  it("overwrites existing config with --force", async () => {
    workspace = await makeTempWorkspace();
    await writeJson(path.join(workspace.dir, "package.json"), {
      name: "tmp",
      type: "module",
    });
    await writeFile(
      path.join(workspace.dir, "nextforge.config.mjs"),
      "export default { old: true }"
    );

    const res = await runCli(workspace.dir, "init", "--force", "--yes");
    expect(res.code).toBe(0);
    expect(res.stdout).toContain("Created nextforge.config.mjs");

    const file = await readText(path.join(workspace.dir, "nextforge.config.mjs"));
    expect(file).not.toContain("old: true");
    expect(file).toContain("appDir:");
  });

  it("suggests running doctor after init", async () => {
    workspace = await makeTempWorkspace();
    await writeJson(path.join(workspace.dir, "package.json"), {
      name: "tmp",
      type: "module",
    });

    const res = await runCli(workspace.dir, "init", "--yes");
    expect(res.code).toBe(0);
    expect(res.stdout).toContain("npx nextforge doctor");
  });

  it("detects package manager from lock file", async () => {
    workspace = await makeTempWorkspace();
    await writeJson(path.join(workspace.dir, "package.json"), {
      name: "tmp",
      type: "module",
      devDependencies: {
        typescript: "5.0.0",
      },
    });
    // Create pnpm lock file
    await writeFile(path.join(workspace.dir, "pnpm-lock.yaml"), "lockfileVersion: 5.4");

    const res = await runCli(workspace.dir, "init");
    // Without --yes, it should suggest the package manager command
    expect(res.code).toBe(0);
    expect(res.stdout).toContain("Created nextforge.config.ts");
    // Should detect pnpm and suggest pnpm command
    expect(res.stdout).toContain("pnpm add -D tsx");
  });
});
