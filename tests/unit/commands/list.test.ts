import { Command } from "commander";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { listCommand } from "../../../src/commands/list.js";
import { registerAddComponent } from "../../../src/commands/add/component.js";
import { registerAddGroup } from "../../../src/commands/add/group.js";
import { registerAddPage } from "../../../src/commands/add/page.js";
import { doctorCommand } from "../../../src/commands/doctor.js";
import { initCommand } from "../../../src/commands/init.js";

describe("list command", () => {
  let originalLog: typeof console.log;
  let logOutput: string[];

  beforeEach(() => {
    originalLog = console.log;
    logOutput = [];
    console.log = (msg: string) => {
      logOutput.push(msg);
    };
  });

  afterEach(() => {
    console.log = originalLog;
  });

  it("lists all registered commands sorted alphabetically", async () => {
    const program = new Command()
      .name("nextforge")
      .option("--verbose", "Enable verbose logs", false);

    // Register commands in the same order as src/index.ts
    program.addCommand(doctorCommand);
    program.addCommand(initCommand);
    program.addCommand(listCommand);
    registerAddGroup(program);
    registerAddPage(program);
    registerAddComponent(program);

    // Configure to throw errors instead of exiting
    program.exitOverride();

    // Run list command
    await program.parseAsync(["list"], { from: "user" });

    // Verify output contains expected commands sorted alphabetically
    expect(logOutput.length).toBeGreaterThan(0);

    // Check that common commands are present
    expect(logOutput).toContain("add:component");
    expect(logOutput).toContain("add:group");
    expect(logOutput).toContain("add:page");
    expect(logOutput).toContain("doctor");
    expect(logOutput).toContain("init");
    expect(logOutput).toContain("list");

    // Verify sorted order
    const sortedOutput = [...logOutput].sort();
    expect(logOutput).toEqual(sortedOutput);
  });

  it("outputs one command per line", async () => {
    const program = new Command()
      .name("nextforge")
      .option("--verbose", "Enable verbose logs", false);

    program.addCommand(doctorCommand);
    program.addCommand(listCommand);
    registerAddGroup(program);

    // Configure to throw errors instead of exiting
    program.exitOverride();

    await program.parseAsync(["list"], { from: "user" });

    // Each output should be a single command name (no spaces)
    for (const line of logOutput) {
      expect(line).not.toContain(" ");
      expect(line.trim()).toBe(line);
    }
  });
});
