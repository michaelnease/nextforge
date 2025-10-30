// src/main.ts (or wherever your entry is)
import { Command } from "commander";

import { registerAddDocker } from "./commands/add/docker.js";
import { registerAddGroup } from "./commands/add/group.js";
import { registerAddPage } from "./commands/add/page.js";
import { doctorCommand } from "./commands/doctor.js";
import { registerInit } from "./commands/init.js";

export async function main(): Promise<void> {
  const program = new Command()
    .name("nextforge")
    .description("Forge pages, APIs, and components for modern Next.js apps")
    .version("0.1.0")
    .option("--verbose", "Enable verbose logs", false);

  // [nextforge.register:commands:start]
  program.addCommand(doctorCommand);
  registerAddGroup(program);
  registerAddPage(program);
  registerAddDocker(program);
  registerInit(program);
  // [nextforge.register:commands:end]

  await program.parseAsync(process.argv);
}
