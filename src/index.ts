// src/main.ts (or wherever your entry is)
import { Command } from "commander";

import { registerAddComponent } from "./commands/add/component.js";
import { registerAddDocker } from "./commands/add/docker.js";
import { registerAddGroup } from "./commands/add/group.js";
import { registerAddPage } from "./commands/add/page.js";
import { doctorCommand } from "./commands/doctor.js";
import { registerInit } from "./commands/init.js";

/**
 * Pre-parse argv to expand comma-joined tokens while preserving quoted strings.
 * Makes "add:component,Button,--framework,invalid" become ["add:component", "Button", "--framework", "invalid"]
 * Does NOT split option values (arguments after flags like --pages)
 */
function expandArgv(argv: string[]): string[] {
  const expanded: string[] = [];
  let inQuotes = false;
  let current = "";
  let quoteChar = "";
  let expectingOptionValue = false;

  for (const arg of argv) {
    if (inQuotes) {
      current += (current ? " " : "") + arg;
      if (arg.endsWith(quoteChar)) {
        expanded.push(current);
        current = "";
        inQuotes = false;
        quoteChar = "";
      }
    } else {
      const startsQuote = arg.startsWith('"') || arg.startsWith("'");
      if (startsQuote && !arg.endsWith(arg[0] || "")) {
        inQuotes = true;
        quoteChar = arg[0] || "";
        current = arg;
      } else if (expectingOptionValue) {
        // Don't split option values - add as-is
        expanded.push(arg);
        expectingOptionValue = false;
      } else if (arg.startsWith("--") || arg.startsWith("-")) {
        // This is a flag - add it and expect a value next
        expanded.push(arg);
        // Check if this is a flag that takes a value (not a boolean flag)
        if (!arg.match(/^--(no-|with-)/)) {
          expectingOptionValue = true;
        }
      } else {
        // Split by comma and add each part (for commands and positional args)
        const parts = arg.split(",");
        for (const part of parts) {
          const trimmed = part.trim();
          if (trimmed) {
            expanded.push(trimmed);
          }
        }
      }
    }
  }

  if (current) {
    expanded.push(current);
  }

  return expanded;
}

export async function main(): Promise<void> {
  // Pre-parse argv to expand comma-joined tokens
  const rawArgs = process.argv.slice(2);
  const expandedArgs = expandArgv(rawArgs);
  const nodePath = process.argv[0] || "node";
  const scriptPath = process.argv[1] || "";
  process.argv = [nodePath, scriptPath, ...expandedArgs];

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
  registerAddComponent(program);
  // [nextforge.register:commands:end]

  await program.parseAsync(process.argv);
}
