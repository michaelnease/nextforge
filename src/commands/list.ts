import { Command } from "commander";

/**
 * List command - prints all available commands
 */
export const listCommand = new Command("list")
  .description("List all available commands")
  .action(() => {
    // This will be populated when registered with the main program
    const program = listCommand.parent;
    if (!program) {
      console.log("list");
      return;
    }

    // Get all commands and sort them
    const commands = program.commands
      .map((cmd) => cmd.name())
      .filter((name) => name) // Filter out empty names
      .sort();

    // Print one per line
    for (const cmd of commands) {
      console.log(cmd);
    }
  });
