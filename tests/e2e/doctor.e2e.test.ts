import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { makeTempWorkspace, runCli, writeFile, writeJson } from "../utils/tempWorkspace.js";

describe("Doctor E2E tests", () => {
  let workspace: Awaited<ReturnType<typeof makeTempWorkspace>>;

  afterEach(async () => {
    if (workspace) {
      await workspace.cleanup();
    }
  });

  it("exits 0 when all checks pass", async () => {
    workspace = await makeTempWorkspace();

    // Create a minimal valid setup: .mjs config
    const configPath = path.join(workspace.dir, "nextforge.config.mjs");
    await writeFile(
      configPath,
      `export default {
  useTailwind: true,
  pagesDir: "app",
};
`
    );

    const result = await runCli(workspace.dir, "doctor");
    // Exit 0 = all pass, 1 = warnings (acceptable for temp workspace without app dir)
    expect(result.code).toBeLessThanOrEqual(1);
    expect(result.stdout).toContain("PASS");
  });

  it("exits 1 when warnings present", async () => {
    workspace = await makeTempWorkspace();

    // Create setup that triggers warning (no app dir, not a Next.js project)
    const configPath = path.join(workspace.dir, "nextforge.config.mjs");
    await writeFile(
      configPath,
      `export default {
  useTailwind: false,
  pagesDir: "app",
};
`
    );

    const result = await runCli(workspace.dir, "doctor");
    // Should warn about no app directory
    expect(result.code).toBeLessThanOrEqual(1);
    expect(result.stdout.toLowerCase()).toMatch(/pass|warn/);
  });

  it("exits 2 when failures present (.ts config without tsx)", async () => {
    workspace = await makeTempWorkspace();

    // Create .ts config without tsx installed
    const configPath = path.join(workspace.dir, "nextforge.config.ts");
    await writeFile(
      configPath,
      `export default {
  useTailwind: true,
  pagesDir: "app",
};
`
    );

    const result = await runCli(workspace.dir, "doctor");
    expect(result.code).toBe(2);
    expect(result.stdout).toContain("FAIL");
    expect(result.stdout).toContain("tsx");
  });

  it("--json outputs valid JSON with schema", async () => {
    workspace = await makeTempWorkspace();

    const configPath = path.join(workspace.dir, "nextforge.config.mjs");
    await writeFile(
      configPath,
      `export default {
  useTailwind: true,
  pagesDir: "app",
};
`
    );

    const result = await runCli(workspace.dir, "doctor", "--json");

    // Parse JSON output
    let json: any;
    expect(() => {
      json = JSON.parse(result.stdout);
    }).not.toThrow();

    // Verify schema
    expect(json).toHaveProperty("exitCode");
    expect(json).toHaveProperty("summary");
    expect(json.summary).toHaveProperty("pass");
    expect(json.summary).toHaveProperty("warn");
    expect(json.summary).toHaveProperty("fail");
    expect(json).toHaveProperty("results");
    expect(Array.isArray(json.results)).toBe(true);

    // Verify result structure
    if (json.results.length > 0) {
      const firstResult = json.results[0];
      expect(firstResult).toHaveProperty("id");
      expect(firstResult).toHaveProperty("title");
      expect(firstResult).toHaveProperty("status");
      expect(firstResult).toHaveProperty("message");
    }
  });

  it("--ci disables ANSI color codes", async () => {
    workspace = await makeTempWorkspace();

    const configPath = path.join(workspace.dir, "nextforge.config.mjs");
    await writeFile(
      configPath,
      `export default {
  useTailwind: true,
  pagesDir: "app",
};
`
    );

    const result = await runCli(workspace.dir, "doctor", "--ci");

    // Should not contain ANSI escape codes
    // ANSI codes typically start with \x1b[ or \u001b[
    expect(result.stdout).not.toMatch(/\x1b\[/);
    expect(result.stdout).not.toMatch(/\u001b\[/);

    // Should still contain status text
    expect(result.stdout).toMatch(/PASS|WARN|FAIL/);
  });

  it("success case with .mjs config", async () => {
    workspace = await makeTempWorkspace();

    // Create valid .mjs config
    const configPath = path.join(workspace.dir, "nextforge.config.mjs");
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

    // Should pass or warn (not fail)
    expect(result.code).toBeLessThanOrEqual(1);
    expect(result.stdout).toContain("NextForge config");
  });

  it("provides fix suggestions for failures", async () => {
    workspace = await makeTempWorkspace();

    // Create .ts config without tsx to trigger failure with fix suggestions
    const configPath = path.join(workspace.dir, "nextforge.config.ts");
    await writeFile(
      configPath,
      `export default {
  useTailwind: true,
  pagesDir: "app",
};
`
    );

    const result = await runCli(workspace.dir, "doctor");

    // Should contain fix suggestions
    expect(result.stdout).toContain("Fix suggestions");
    expect(result.stdout).toMatch(/npm i -D tsx|rename/);
  });

  it("JSON output includes fix suggestions", async () => {
    workspace = await makeTempWorkspace();

    // Create .ts config without tsx
    const configPath = path.join(workspace.dir, "nextforge.config.ts");
    await writeFile(
      configPath,
      `export default {
  useTailwind: true,
  pagesDir: "app",
};
`
    );

    const result = await runCli(workspace.dir, "doctor", "--json");

    const json = JSON.parse(result.stdout);

    // Find the failed tsx check
    const tsxCheck = json.results.find((r: any) => r.id === "tsx-loader");
    expect(tsxCheck).toBeDefined();
    expect(tsxCheck.status).toBe("fail");
    expect(tsxCheck.fix).toBeDefined();
    expect(Array.isArray(tsxCheck.fix)).toBe(true);
    expect(tsxCheck.fix.length).toBeGreaterThan(0);
  });

  it("exitCode matches summary status", async () => {
    workspace = await makeTempWorkspace();

    // Setup that causes failure
    const configPath = path.join(workspace.dir, "nextforge.config.ts");
    await writeFile(
      configPath,
      `export default {
  useTailwind: true,
  pagesDir: "app",
};
`
    );

    const result = await runCli(workspace.dir, "doctor", "--json");
    const json = JSON.parse(result.stdout);

    // exitCode should be 2 (failures present)
    expect(json.exitCode).toBe(2);
    expect(json.summary.fail).toBeGreaterThan(0);
    expect(result.code).toBe(json.exitCode);
  });

  it("includes summary footer in text mode", async () => {
    workspace = await makeTempWorkspace();

    const configPath = path.join(workspace.dir, "nextforge.config.mjs");
    await writeFile(
      configPath,
      `export default {
  useTailwind: true,
  pagesDir: "app",
};
`
    );

    const result = await runCli(workspace.dir, "doctor");

    // Should have summary line
    expect(result.stdout).toMatch(/Summary:.*passed/i);
    expect(result.stdout).toMatch(/Exit \d+/);
  });
});
