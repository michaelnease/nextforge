import { Command } from "commander";

import { registerAddGroup } from "./commands/add/group.js";
import { doctorCommand } from "./commands/doctor.js";

export async function main(): Promise<void> {
  const program = new Command()
    .name("nextforge")
    .description("Forge pages, APIs, and components for modern Next.js apps")
    .version("0.1.0");

  // Note: doctorCommand must be invoked to get the Command instance
  program.addCommand(doctorCommand); // ✅ pass the instance
  registerAddGroup(program);

  await program.parseAsync(process.argv);
}
