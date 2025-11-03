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

  it("creates rules file", async () => {
    await runCLI(["add:cursor", "rules", "--name", "component"]);

    const filePath = join(ws.dir, ".nextforge/cursor/rules/component.rules.md");
    await expect(exists(filePath)).resolves.toBe(true);

    const content = await readText(filePath);
    expect(content).toContain("Cursor Rules — component");
    expect(content).toContain("## Purpose");
    expect(content).toContain("## Cursor Setup");
    expect(content).toContain("## Example Prompt");
  });

  it("creates phase file", async () => {
    await runCLI(["add:cursor", "phase", "--phase", "1"]);

    const filePath = join(ws.dir, ".nextforge/cursor/phases/phase-1.md");
    await expect(exists(filePath)).resolves.toBe(true);

    const content = await readText(filePath);
    expect(content).toContain("# Phase 1");
    expect(content).toContain("## Goal");
    expect(content).toContain("## Steps");
    expect(content).toContain("## Cursor Prompt Example");
  });

  it("force overwrites", async () => {
    const filePath = join(ws.dir, ".nextforge/cursor/rules/test.rules.md");

    // Create first time
    await runCLI(["add:cursor", "rules", "--name", "test"]);
    const firstContent = await readText(filePath);
    expect(firstContent).toContain("Cursor Rules — test");

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
    expect(afterForce).toContain("Cursor Rules — test");
    expect(afterForce).not.toBe("modified content");
  });

  it("invalid type errors", async () => {
    await expect(runCLI(["add:cursor", "invalid"])).rejects.toThrow(
      "Invalid cursor type. Use 'rules' or 'phase'."
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
      "--phase must be a positive number"
    );

    await expect(runCLI(["add:cursor", "phase", "--phase", "-1"])).rejects.toThrow(
      "--phase must be a positive number"
    );

    await expect(runCLI(["add:cursor", "phase", "--phase", "abc"])).rejects.toThrow(
      "--phase must be a positive number"
    );
  });

  it("creates different phase files", async () => {
    await runCLI(["add:cursor", "phase", "--phase", "2"]);
    await runCLI(["add:cursor", "phase", "--phase", "3"]);

    const phase2Path = join(ws.dir, ".nextforge/cursor/phases/phase-2.md");
    const phase3Path = join(ws.dir, ".nextforge/cursor/phases/phase-3.md");

    await expect(exists(phase2Path)).resolves.toBe(true);
    await expect(exists(phase3Path)).resolves.toBe(true);

    const phase2Content = await readText(phase2Path);
    const phase3Content = await readText(phase3Path);

    expect(phase2Content).toContain("# Phase 2");
    expect(phase3Content).toContain("# Phase 3");
  });

  it("logs write/skip/force overwrite messages", async () => {
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(" "));

    try {
      const filePath = join(ws.dir, ".nextforge/cursor/rules/logging-test.rules.md");

      // First creation - should log "write"
      await runCLI(["add:cursor", "rules", "--name", "logging-test"]);
      expect(logs[logs.length - 1]).toContain("write");
      expect(logs[logs.length - 1]).toContain(".nextforge/cursor/rules/logging-test.rules.md");

      // Second run without force - should log "skip"
      await runCLI(["add:cursor", "rules", "--name", "logging-test"]);
      expect(logs[logs.length - 1]).toContain("skip");
      expect(logs[logs.length - 1]).toContain("(exists)");

      // Third run with force - should log "force overwrite"
      await runCLI(["add:cursor", "rules", "--name", "logging-test", "--force"]);
      expect(logs[logs.length - 1]).toContain("force overwrite");
    } finally {
      console.log = originalLog;
    }
  });
});
