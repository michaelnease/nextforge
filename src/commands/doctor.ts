import { Command } from "commander";

import { runDoctor } from "../utils/doctor/runDoctor.js";
import { runCommand } from "../utils/runCommand.js";

/**
 * Doctor command - runs health checks for NextForge setup
 *
 * Exit codes:
 *   0 - All checks passed
 *   1 - Warnings found (non-critical issues)
 *   2 - Failures found (critical issues)
 *   3 - Doctor crashed unexpectedly
 *
 * This convention allows CI to fail on failures (exit 2) but pass on warnings (exit 1).
 */
export const doctorCommand = new Command("doctor")
  .description("Run health checks for your NextForge setup")
  .option("--app <path>", "Path to Next.js app directory")
  .option("--json", "Output JSON instead of text")
  .option("--fix", "Try safe autofixes")
  .option("--ci", "CI-friendly mode (no colors, no prompts)")
  .option("--deep", "Run deep checks like tsc validation")
  .option("--verbose", "Verbose logging")
  .action(async (opts) => {
    try {
      await runCommand(
        "doctor",
        async (logger) => {
          logger.debug({ opts }, "Doctor command options");
          const exitCode = await runDoctor(opts);
          process.exit(exitCode);
        },
        { verbose: opts.verbose, silent: opts.json }
      );
    } catch (err) {
      console.error("Doctor crashed:", err);
      process.exit(3);
    }
  });
