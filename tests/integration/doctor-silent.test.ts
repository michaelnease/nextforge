import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { Command } from "commander";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { makeTempWorkspace, writeJson } from "../utils/tempWorkspace.js";

import { doctorCommand } from "../../src/commands/doctor.js";

describe("doctor --silent mode", () => {
  let ws: Awaited<ReturnType<typeof makeTempWorkspace>>;
  let originalCwd: string;
  let originalLog: typeof console.log;
  let logOutput: string[];

  beforeEach(async () => {
    ws = await makeTempWorkspace();
    originalCwd = process.cwd();
    process.chdir(ws.dir);

    // Capture console.log output
    originalLog = console.log;
    logOutput = [];
    console.log = (...args: unknown[]) => {
      logOutput.push(args.join(" "));
    };
  });

  afterEach(async () => {
    console.log = originalLog;
    process.chdir(originalCwd);
    await ws.cleanup();
  });

  it("suppresses stdout in silent mode", async () => {
    const program = new Command().name("nextforge");
    program.addCommand(doctorCommand);
    program.exitOverride();
    // Suppress error output during tests
    program.configureOutput({ outputError: () => {} });

    // Create app directory to avoid failures
    await mkdir(join(ws.dir, "app"));

    try {
      await program.parseAsync(["doctor", "--silent"], { from: "user" });
    } catch (err) {
      // Doctor may throw on warnings/failures, but we still want to verify stdout
    }

    // Verify no output to stdout in silent mode
    expect(logOutput).toEqual([]);
  });

  it("outputs JSON in silent mode with --json", async () => {
    const program = new Command().name("nextforge");
    program.addCommand(doctorCommand);
    program.exitOverride();
    program.configureOutput({ outputError: () => {} });

    // Create app directory
    await mkdir(join(ws.dir, "app"));

    try {
      await program.parseAsync(["doctor", "--silent", "--json"], { from: "user" });
    } catch (err) {
      // May throw on warnings/failures
    }

    // Verify JSON output is present
    expect(logOutput.length).toBeGreaterThan(0);
    const jsonOutput = logOutput.join("\n");
    expect(() => JSON.parse(jsonOutput)).not.toThrow();

    const parsed = JSON.parse(jsonOutput);
    expect(parsed).toHaveProperty("results");
    expect(parsed).toHaveProperty("summary");
    expect(parsed).toHaveProperty("exitCode");
  });

  it("returns correct exit code on success", async () => {
    const program = new Command().name("nextforge");
    program.addCommand(doctorCommand);
    program.exitOverride();
    program.configureOutput({ outputError: () => {} });

    // Create app directory for success
    await mkdir(join(ws.dir, "app"));

    // Doctor should succeed (or at most warn)
    let exitCode = 0;
    try {
      await program.parseAsync(["doctor", "--silent"], { from: "user" });
    } catch (err) {
      // Check if it's a CommanderError with exitCode
      if (err && typeof err === "object" && "exitCode" in err) {
        exitCode = (err as { exitCode: number }).exitCode;
      }
    }

    // Exit code should be 0 (success) or 1 (warnings)
    expect([0, 1]).toContain(exitCode);
  });

  it("returns non-zero exit code on failures", async () => {
    const program = new Command().name("nextforge");
    program.addCommand(doctorCommand);
    program.exitOverride();
    program.configureOutput({ outputError: () => {} });

    // Create package.json with next dependency to ensure it's detected as a Next.js project
    // This makes the missing app directory a FAILURE (exit 2) instead of a WARNING (exit 1)
    // In CI mode, warnings are treated as success, but failures always throw
    await writeJson(join(ws.dir, "package.json"), {
      name: "test-project",
      dependencies: { next: "^14.0.0" },
    });

    // Don't create app directory - this should cause a failure
    let exitCode = 0;
    try {
      await program.parseAsync(["doctor", "--silent"], { from: "user" });
    } catch (err) {
      if (err && typeof err === "object" && "exitCode" in err) {
        exitCode = (err as { exitCode: number }).exitCode;
      }
    }

    // Should have non-zero exit code for failures
    expect(exitCode).toBeGreaterThan(0);
  });
});
