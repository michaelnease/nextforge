import { join } from "node:path";

import { Command } from "commander";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { makeTempWorkspace, readText, writeFile } from "../utils/tempWorkspace.js";

import { registerAddCursor } from "../../src/commands/add/cursor.js";

async function runCLI(args: string[]) {
  const program = new Command().name("nextforge").option("--verbose", "Enable verbose logs", false);
  registerAddCursor(program);
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

describe("add:cursor", () => {
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

  it("creates rules file in JSON format by default", async () => {
    await runCLI(["add:cursor", "rules", "--name", "component"]);

    const filePath = join(ws.dir, ".nextforge/cursor/rules/component.rules.json");
    await expect(exists(filePath)).resolves.toBe(true);

    const content = await readText(filePath);
    const parsed = JSON.parse(content);
    expect(parsed.name).toBe("component");
    expect(parsed.$schema).toBeDefined();
  });

  it("creates phase file in JSON format by default", async () => {
    await runCLI(["add:cursor", "phase", "--phase", "1"]);

    const filePath = join(ws.dir, ".nextforge/cursor/phases/phase-1.json");
    await expect(exists(filePath)).resolves.toBe(true);

    const content = await readText(filePath);
    const parsed = JSON.parse(content);
    expect(parsed.phase).toBe(1);
    expect(parsed.title).toBe("Phase 1");
  });

  it("creates MDX files when --mdx flag is used", async () => {
    await runCLI(["add:cursor", "rules", "--name", "test-mdx", "--mdx"]);

    const filePath = join(ws.dir, ".nextforge/cursor/rules/test-mdx.rules.mdx");
    await expect(exists(filePath)).resolves.toBe(true);

    const content = await readText(filePath);
    expect(content).toContain("# Cursor Rules — test-mdx");
    expect(content).toContain("## Purpose");
  });

  it("creates MDX phase files when --mdx flag is used", async () => {
    await runCLI(["add:cursor", "phase", "--phase", "5", "--mdx"]);

    const filePath = join(ws.dir, ".nextforge/cursor/phases/phase-5.mdx");
    await expect(exists(filePath)).resolves.toBe(true);

    const content = await readText(filePath);
    expect(content).toContain("# Phase 5");
    expect(content).toContain("## Goal");
  });

  it("force overwrites existing files", async () => {
    const filePath = join(ws.dir, ".nextforge/cursor/rules/test.rules.json");

    // Create first time
    await runCLI(["add:cursor", "rules", "--name", "test"]);
    const firstContent = await readText(filePath);
    expect(JSON.parse(firstContent).name).toBe("test");

    // Modify the file
    await writeFile(filePath, "modified content");
    const modifiedContent = await readText(filePath);
    expect(modifiedContent).toBe("modified content");

    // Try without force - should not overwrite
    await runCLI(["add:cursor", "rules", "--name", "test"]);
    const afterNoForce = await readText(filePath);
    expect(afterNoForce).toBe("modified content");

    // Try with force - should overwrite
    await runCLI(["add:cursor", "rules", "--name", "test", "--force"]);
    const afterForce = await readText(filePath);
    expect(JSON.parse(afterForce).name).toBe("test");
    expect(afterForce).not.toBe("modified content");
  });

  it("invalid type errors", async () => {
    await expect(runCLI(["add:cursor", "invalid"])).rejects.toThrow(
      'Invalid type. Use one of: "rules", "phase"'
    );
  });

  it("missing required flag errors", async () => {
    // Missing --name for rules
    await expect(runCLI(["add:cursor", "rules"])).rejects.toThrow(
      "--name is required for type 'rules'"
    );

    // Missing --phase for phase
    await expect(runCLI(["add:cursor", "phase"])).rejects.toThrow(
      "--phase is required for type 'phase'"
    );
  });

  it("validates phase number is positive", async () => {
    await expect(runCLI(["add:cursor", "phase", "--phase", "0"])).rejects.toThrow(
      "--phase must be a positive integer"
    );

    await expect(runCLI(["add:cursor", "phase", "--phase", "-1"])).rejects.toThrow(
      "--phase must be a positive integer"
    );

    await expect(runCLI(["add:cursor", "phase", "--phase", "abc"])).rejects.toThrow(
      "--phase must be a positive integer"
    );
  });

  it("creates different phase files", async () => {
    await runCLI(["add:cursor", "phase", "--phase", "2"]);
    await runCLI(["add:cursor", "phase", "--phase", "3"]);

    const phase2Path = join(ws.dir, ".nextforge/cursor/phases/phase-2.json");
    const phase3Path = join(ws.dir, ".nextforge/cursor/phases/phase-3.json");

    await expect(exists(phase2Path)).resolves.toBe(true);
    await expect(exists(phase3Path)).resolves.toBe(true);

    const phase2Content = JSON.parse(await readText(phase2Path));
    const phase3Content = JSON.parse(await readText(phase3Path));

    expect(phase2Content.phase).toBe(2);
    expect(phase3Content.phase).toBe(3);
  });

  it("logs write/skip/force overwrite messages", async () => {
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(" "));

    try {
      const filePath = join(ws.dir, ".nextforge/cursor/rules/logging-test.rules.json");

      // First creation - should log "write"
      await runCLI(["add:cursor", "rules", "--name", "logging-test"]);
      expect(
        logs.some((log) => log.includes("write") && log.includes("logging-test.rules.json"))
      ).toBe(true);

      // Second run without force - should log "skip"
      await runCLI(["add:cursor", "rules", "--name", "logging-test"]);
      expect(logs.some((log) => log.includes("skip") && log.includes("(exists)"))).toBe(true);

      // Third run with force - should log "force overwrite"
      await runCLI(["add:cursor", "rules", "--name", "logging-test", "--force"]);
      expect(logs.some((log) => log.includes("force overwrite"))).toBe(true);
    } finally {
      console.log = originalLog;
    }
  });

  it("normalizes names to kebab-case", async () => {
    await runCLI(["add:cursor", "rules", "--name", "My Component Test"]);

    const filePath = join(ws.dir, ".nextforge/cursor/rules/my-component-test.rules.json");
    await expect(exists(filePath)).resolves.toBe(true);

    const content = JSON.parse(await readText(filePath));
    expect(content.name).toBe("my-component-test");
  });

  it("rejects empty names", async () => {
    await expect(runCLI(["add:cursor", "rules", "--name", ""])).rejects.toThrow(
      "Invalid --name. Use letters/numbers. Example: audit-trace"
    );

    await expect(runCLI(["add:cursor", "rules", "--name", "   "])).rejects.toThrow(
      "Invalid --name. Use letters/numbers. Example: audit-trace"
    );
  });

  it("rejects invalid names with only special characters", async () => {
    await expect(runCLI(["add:cursor", "rules", "--name", "!!!"])).rejects.toThrow(
      "Invalid --name. Use letters/numbers. Example: audit-trace"
    );
  });

  it("handles quotes in names", async () => {
    await runCLI(["add:cursor", "rules", "--name", '"web-api"']);

    const filePath = join(ws.dir, ".nextforge/cursor/rules/web-api.rules.json");
    await expect(exists(filePath)).resolves.toBe(true);
  });

  it("removes consecutive dashes", async () => {
    await runCLI(["add:cursor", "rules", "--name", "my---component"]);

    const filePath = join(ws.dir, ".nextforge/cursor/rules/my-component.rules.json");
    await expect(exists(filePath)).resolves.toBe(true);
  });

  it("creates index.json to track generated files", async () => {
    await runCLI(["add:cursor", "rules", "--name", "test-index"]);
    await runCLI(["add:cursor", "phase", "--phase", "1"]);

    const indexPath = join(ws.dir, ".nextforge/cursor/index.json");
    await expect(exists(indexPath)).resolves.toBe(true);

    const indexContent = await readText(indexPath);
    const index = JSON.parse(indexContent);

    expect(Array.isArray(index)).toBe(true);
    expect(index.length).toBeGreaterThanOrEqual(2);
    expect(index.some((item: { type: string }) => item.type === "rules")).toBe(true);
    expect(index.some((item: { type: string }) => item.type === "phases")).toBe(true);
    expect(index.some((item: { format: string }) => item.format === "json")).toBe(true);
  });

  it("updates index.json on duplicate file overwrites", async () => {
    // Create initial file
    await runCLI(["add:cursor", "rules", "--name", "duplicate-test"]);

    const indexPath = join(ws.dir, ".nextforge/cursor/index.json");
    const firstIndex = JSON.parse(await readText(indexPath));
    const initialLength = firstIndex.length;

    // Overwrite with force
    await runCLI(["add:cursor", "rules", "--name", "duplicate-test", "--force"]);

    const secondIndex = JSON.parse(await readText(indexPath));
    // Length should be the same (not duplicated)
    expect(secondIndex.length).toBe(initialLength);
  });

  it("uses config cursorDir if specified", async () => {
    // Create a custom config
    await writeFile(
      join(ws.dir, "nextforge.config.json"),
      JSON.stringify({ cursorDir: ".custom/cursor" }, null, 2)
    );

    await runCLI(["add:cursor", "rules", "--name", "custom-dir"]);

    const filePath = join(ws.dir, ".custom/cursor/rules/custom-dir.rules.json");
    await expect(exists(filePath)).resolves.toBe(true);
  });

  it("respects --cursor-dir over config", async () => {
    // Create a custom config
    await writeFile(
      join(ws.dir, "nextforge.config.json"),
      JSON.stringify({ cursorDir: ".custom/from-config" }, null, 2)
    );

    await runCLI(["add:cursor", "rules", "--name", "security", "--cursor-dir", ".cursor/cli"]);

    const filePath = join(ws.dir, ".cursor/cli/rules/security.rules.json");
    await expect(exists(filePath)).resolves.toBe(true);

    const content = JSON.parse(await readText(filePath));
    expect(content.name).toBe("security");
  });

  it("uses default .nextforge/cursor when no config or flag", async () => {
    await runCLI(["add:cursor", "rules", "--name", "default-location"]);

    const filePath = join(ws.dir, ".nextforge/cursor/rules/default-location.rules.json");
    await expect(exists(filePath)).resolves.toBe(true);
  });

  it("tracks format in index for both JSON and MDX", async () => {
    await runCLI(["add:cursor", "rules", "--name", "json-test"]);
    await runCLI(["add:cursor", "rules", "--name", "mdx-test", "--mdx"]);

    const indexPath = join(ws.dir, ".nextforge/cursor/index.json");
    const index = JSON.parse(await readText(indexPath));

    const jsonEntry = index.find((item: { name: string }) => item.name === "json-test");
    const mdxEntry = index.find((item: { name: string }) => item.name === "mdx-test");

    expect(jsonEntry.format).toBe("json");
    expect(mdxEntry.format).toBe("mdx");
  });
});
