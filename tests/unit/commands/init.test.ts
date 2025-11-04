import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { initCommand } from "../../../src/commands/init.js";

describe("nextforge init unit", () => {
  let tempDir: string | null = null;
  let originalCwd: string;

  afterEach(async () => {
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
      tempDir = null;
    }
    if (originalCwd) {
      process.chdir(originalCwd);
    }
  });

  it("should have init command with correct metadata", () => {
    expect(initCommand.name()).toBe("init");
    expect(initCommand.description()).toBe("Initialize NextForge configuration");
  });

  it("should have --force and --yes options", () => {
    const options = initCommand.options;
    const optionNames = options.map((opt) => opt.long);
    expect(optionNames).toContain("--force");
    expect(optionNames).toContain("--yes");
  });
});
