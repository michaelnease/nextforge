import { Command } from "commander";

import { doctorCommand } from "./commands/doctor.js";

export async function main(): Promise<void> {
  const program = new Command()
    .name("nextforge")
    .description("A CLI tool for Next.js project scaffolding and management")
    .version("0.1.0");

  program.addCommand(doctorCommand);

  await program.parseAsync(process.argv);
}
