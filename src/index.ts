// src/main.ts (or wherever your entry is)
import { Command } from "commander";

import { registerAddComponent } from "./commands/add/component.js";
import { registerAddCursor } from "./commands/add/cursor.js";
import { registerAddDocker } from "./commands/add/docker.js";
import { registerAddGroup } from "./commands/add/group.js";
import { registerAddPage } from "./commands/add/page.js";
import { doctorCommand } from "./commands/doctor.js";
import { initCommand } from "./commands/init.js";
import { listCommand } from "./commands/list.js";

/**
 * Detect if arguments contain shell-expanded brackets that should have been quoted.
 * Common issue: zsh expands [slug] to 'slug' or nothing without setopt no_nomatch.
 */
function detectBracketExpansion(argv: string[]): string | null {
  // Check for standalone bracket chars that suggest expansion happened
  const hasSingleBracket = argv.some((arg) => arg === "[" || arg === "]");
  if (hasSingleBracket) {
    return "Detected unmatched brackets. If using dynamic routes like [slug], quote the argument: '[slug]'";
  }

  // Check for bracket-like patterns that might be partial expansions
  // Only flag if brackets are unmatched within a single argument
  const hasUnmatchedBracket = argv.some((arg) => {
    const openCount = (arg.match(/\[/g) || []).length;
    const closeCount = (arg.match(/\]/g) || []).length;
    return openCount !== closeCount;
  });

  if (hasUnmatchedBracket) {
    return "Detected incomplete bracket syntax. Quote dynamic routes like '[slug]' or '[...id]'";
  }

  return null;
}

/**
 * Pre-parse argv to expand comma-joined tokens while preserving quoted strings.
 * Makes "add:component,Button,--framework,invalid" become ["add:component", "Button", "--framework", "invalid"]
 * Does NOT split option values (arguments after flags like --pages)
 *
 * Handles:
 * - Comma-separated arguments (expanded unless after a flag)
 * - Quoted strings (preserved as single arguments)
 * - Bracket syntax like [slug] (should be quoted by user)
 * - Option values (not split, preserved as-is)
 */
function expandArgv(argv: string[]): string[] {
  // Detect common shell bracket expansion issues
  const bracketIssue = detectBracketExpansion(argv);
  if (bracketIssue) {
    console.error(`\nError: ${bracketIssue}`);
    console.error("\nHint: If your shell expands brackets, quote the argument.");
    console.error("  Example: nextforge add:page 'blog/[slug]' --app app\n");
    process.exit(1);
  }

  const expanded: string[] = [];
  let inQuotes = false;
  let current = "";
  let quoteChar = "";
  let expectingOptionValue = false;
  let previousFlag = "";

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
        // Special handling for --pages flag: respect quoted comma lists
        if (previousFlag === "--pages" && arg.includes(",")) {
          // If it has commas and is already quoted in source, it was intentional
          // Otherwise, treat commas as separators (legacy behavior)
          expanded.push(arg);
        } else {
          expanded.push(arg);
        }
        expectingOptionValue = false;
        previousFlag = "";
      } else if (arg.startsWith("--") || arg.startsWith("-")) {
        // This is a flag - add it and expect a value next
        expanded.push(arg);
        previousFlag = arg;
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
  program.addCommand(initCommand);
  program.addCommand(listCommand);
  registerAddGroup(program);
  registerAddPage(program);
  registerAddDocker(program);
  registerAddComponent(program);
  registerAddCursor(program);
  // [nextforge.register:commands:end]

  await program.parseAsync(process.argv);
}

// Export programmatic API for parent apps
export { createCursorRules, createCursorPhase } from "./api/cursor.js";
export type { CreateCursorRulesOptions, CreateCursorPhaseOptions } from "./api/cursor.js";
