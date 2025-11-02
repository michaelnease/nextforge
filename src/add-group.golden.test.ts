import { join } from "node:path";

import { Command } from "commander";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { makeTempWorkspace, readText } from "../tests/utils/tempWorkspace.js";

import { registerAddGroup } from "./commands/add/group.js";

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
  let ws: { dir: string; restore: () => void };

  beforeEach(async () => {
    ws = await makeTempWorkspace();
  });
  afterEach(async () => {
    ws.restore();
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
});
