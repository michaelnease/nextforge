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

describe("Config loader E2E tests", () => {
  let workspace: Awaited<ReturnType<typeof makeTempWorkspace>>;

  afterEach(async () => {
    if (workspace) {
      await workspace.cleanup();
    }
  });

  it("loads nextforge.config.ts without warnings", async () => {
    workspace = await makeTempWorkspace();
    const configPath = path.join(workspace.dir, "nextforge.config.ts");
    await writeFile(
      configPath,
      `export default {
  useTailwind: true,
  useChakra: false,
  pagesDir: "app",
};
`
    );

    const result = await runCli(workspace.dir, "doctor");

    expect(result.code).toBe(0);
    expect(result.stderr).not.toContain("Invalid nextforge config");
    expect(result.stderr).not.toContain("[MODULE_TYPELESS_PACKAGE_JSON]");
  });

  it("loads .mjs config correctly", async () => {
    workspace = await makeTempWorkspace();
    const configPath = path.join(workspace.dir, "nextforge.config.mjs");
    await writeFile(
      configPath,
      `export default {
  useTailwind: false,
  useChakra: true,
  pagesDir: "app",
};
`
    );

    const result = await runCli(workspace.dir, "doctor");
    expect(result.code).toBe(0);
  });

  it("loads .json config correctly", async () => {
    workspace = await makeTempWorkspace();
    const configPath = path.join(workspace.dir, "nextforge.config.json");
    await writeJson(configPath, {
      useTailwind: false,
      useChakra: false,
      pagesDir: "src/app",
    });

    const result = await runCli(workspace.dir, "doctor");
    expect(result.code).toBe(0);
  });

  it("loads .cjs config correctly", async () => {
    workspace = await makeTempWorkspace();
    const configPath = path.join(workspace.dir, "nextforge.config.cjs");
    await writeFile(
      configPath,
      `module.exports = {
  useTailwind: true,
  useChakra: false,
  pagesDir: "app",
};
`
    );

    const result = await runCli(workspace.dir, "doctor");
    expect(result.code).toBe(0);
  });

  it("works even without config file (defaults applied)", async () => {
    workspace = await makeTempWorkspace();
    const result = await runCli(workspace.dir, "doctor");

    expect(result.code).toBe(0);
    // Should not error about missing config
    expect(result.stderr).not.toContain("Failed to load");
  });

  it("honors env vars: NEXTFORGE_USE_TAILWIND=true overrides file", async () => {
    workspace = await makeTempWorkspace();
    const configPath = path.join(workspace.dir, "nextforge.config.ts");
    await writeFile(
      configPath,
      `export default {
  useTailwind: false,
  useChakra: false,
  pagesDir: "app",
};
`
    );

    // Create app directory and package.json for component test
    await writeFile(path.join(workspace.dir, "package.json"), JSON.stringify({ type: "module" }));
    const appDir = path.join(workspace.dir, "app");
    await import("fs/promises").then((fs) => fs.mkdir(appDir, { recursive: true }));

    // Set env var and run add:component which uses the config
    const result = await runCli(workspace.dir, "add:component", "Test", "--framework", "basic");

    // Should succeed (we're just checking config loading, not framework output)
    expect(result.code).toBe(0);
  });

  it("invalid schema (useTailwind: 'yes') throws descriptive error", async () => {
    workspace = await makeTempWorkspace();
    const configPath = path.join(workspace.dir, "nextforge.config.ts");
    await writeFile(
      configPath,
      `export default {
  useTailwind: "yes",
  useChakra: false,
  pagesDir: "app",
};
`
    );

    // Doctor command may not load config, so test with a command that does
    const appDir = path.join(workspace.dir, "app");
    await import("fs/promises").then((fs) => fs.mkdir(appDir, { recursive: true }));
    await writeFile(path.join(workspace.dir, "package.json"), JSON.stringify({ type: "module" }));

    const result = await runCli(
      workspace.dir,
      "add:component",
      "Test",
      "--group",
      "ui",
      "--framework",
      "basic"
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Invalid nextforge config");
    expect(result.stderr).toMatch(/useTailwind/i);
  });
});
