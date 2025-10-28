// src/main.ts (or wherever your entry is)
import { Command } from "commander";

import { registerAddGroup } from "./commands/add/group.js";
import { registerAddPage } from "./commands/add/page.js"; // ⬅ add this
import { doctorCommand } from "./commands/doctor.js";

export async function main(): Promise<void> {
  const program = new Command()
    .name("nextforge")
    .description("Forge pages, APIs, and components for modern Next.js apps")
    .version("0.1.0");

  program.addCommand(doctorCommand);
  registerAddGroup(program);
  registerAddPage(program);

  await program.parseAsync(process.argv);
}
