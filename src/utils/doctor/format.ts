import kleur from "kleur";

import type { DoctorResult, DoctorFlags } from "./runDoctor.js";

/**
 * Check if colors should be disabled based on environment variables
 */
function shouldDisableColors(): boolean {
  return (
    process.env.NO_COLOR !== undefined ||
    process.env.FORCE_COLOR === "0" ||
    process.env.TERM === "dumb"
  );
}

/**
 * Detect if a fix suggestion is a shell command that can be copy-pasted
 */
function isShellCommand(suggestion: string): boolean {
  // Check for common command patterns
  return (
    suggestion.startsWith("npm ") ||
    suggestion.startsWith("npx ") ||
    suggestion.startsWith("echo ") ||
    suggestion.startsWith("setopt ") ||
    suggestion.startsWith("mkdir ") ||
    suggestion.includes(" >> ") ||
    suggestion.includes("nvm install") ||
    suggestion.includes("node --version")
  );
}

export function formatResults(results: DoctorResult[], flags: DoctorFlags): number {
  const disableColors = flags.ci || flags.json || shouldDisableColors();
  const lines: string[] = [];

  let passed = 0;
  let failed = 0;
  let warned = 0;
  const shellCommands: string[] = [];

  for (const r of results) {
    const color =
      r.status === "pass" ? kleur.green : r.status === "warn" ? kleur.yellow : kleur.red;

    const statusText = r.status.toUpperCase();
    const statusDisplay = disableColors ? statusText : color(statusText);
    lines.push(`${statusDisplay}  ${r.title}: ${r.message}`);

    // Include details if verbose
    if (r.details && flags.verbose) {
      lines.push(`  Details: ${r.details}`);
    }

    // Include fix suggestions
    if (r.fix && r.fix.length > 0) {
      lines.push(`  Fix suggestions:`);
      for (const suggestion of r.fix) {
        lines.push(`    - ${suggestion}`);
        // Collect shell commands for the shell fixes section
        if (isShellCommand(suggestion)) {
          shellCommands.push(suggestion);
        }
      }
    }

    if (r.status === "pass") passed++;
    if (r.status === "fail") failed++;
    if (r.status === "warn") warned++;
  }

  const exitCode = failed > 0 ? 2 : warned > 0 ? 1 : 0;

  // Output JSON if --json is set, even if --silent is true
  if (flags.json) {
    console.log(
      JSON.stringify(
        {
          results: results.map((r) => ({
            id: r.id,
            title: r.title,
            status: r.status,
            message: r.message,
            details: r.details,
            fix: r.fix,
          })),
          summary: {
            pass: passed,
            warn: warned,
            fail: failed,
          },
          exitCode,
        },
        null,
        2
      )
    );
    return exitCode;
  }

  // Skip all output if silent mode (no JSON output)
  if (flags.silent) {
    return exitCode;
  }

  // Normal text output
  {
    console.log("\nNextForge Doctor Report\n");
    console.log(lines.join("\n"));
    console.log();

    // Shell fixes section (if any commands to copy-paste)
    if (shellCommands.length > 0 && !flags.ci) {
      const fixHeader = disableColors
        ? "\nShell Fixes (copy-paste):"
        : kleur.cyan("\nShell Fixes (copy-paste):");
      console.log(fixHeader);
      for (const cmd of shellCommands) {
        console.log(`  ${cmd}`);
      }
      console.log();
    }

    // Summary footer with exit code convention
    const summaryParts = [];
    if (passed > 0) summaryParts.push(`${passed} passed`);
    if (warned > 0) summaryParts.push(`${warned} warnings`);
    if (failed > 0) summaryParts.push(`${failed} failed`);

    const exitCodeInfo = disableColors
      ? `Exit ${exitCode}`
      : exitCode === 0
        ? kleur.green(`Exit ${exitCode}`)
        : exitCode === 1
          ? kleur.yellow(`Exit ${exitCode}`)
          : kleur.red(`Exit ${exitCode}`);

    console.log(`Summary: ${summaryParts.join(", ")} • ${exitCodeInfo}\n`);
  }

  if (failed > 0) return 2;
  if (warned > 0) return 1;
  return 0;
}
