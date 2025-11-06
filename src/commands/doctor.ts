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
  .option("--profile", "Enable detailed performance profiling")
  .option("--metrics <format>", "Output performance metrics (format: json)")
  .action(async (opts) => {
    await runCommand(
      "doctor",
      async ({ logger }) => {
        logger.debug({ opts }, "Doctor command options");
        const exitCode = await runDoctor({
          ...opts,
          silent: opts.metrics === "json",
        });

        // If exitCode is non-zero, throw an error with the exitCode property
        // This allows runCommand to finish, log profile, and set proper exit code
        if (exitCode !== 0) {
          const err = new Error(
            exitCode === 1 ? "Doctor found warnings" : "Doctor found failures"
          ) as Error & { exitCode: number };
          err.exitCode = exitCode;
          throw err;
        }
      },
      {
        verbose: opts.verbose,
        silent: opts.json || opts.metrics === "json",
        profile: opts.profile,
        metricsJson: opts.metrics === "json",
      }
    );
  });
