import { Command } from "commander";

import { runDoctor } from "../utils/doctor/runDoctor.js";
import { runCommand } from "../utils/runCommand.js";

/**
 * Doctor command - runs health checks for NextForge setup
 *
 * Exit codes:
 *   0 - All checks passed (or only warnings in CI mode)
 *   1 - Warnings found (non-critical issues, local mode only)
 *   2 - Failures found (critical issues)
 *   3 - Doctor crashed unexpectedly
 *
 * In CI mode (--ci flag or CI env var), warnings are treated as success (exit 0).
 * This convention allows CI to fail only on actual failures (exit 2+).
 */
export const doctorCommand = new Command("doctor")
  .description("Run health checks for your NextForge setup")
  .option("--app <path>", "Path to Next.js app directory")
  .option("--json", "Output JSON instead of text")
  .option("--fix", "Try safe autofixes")
  .option("--ci", "CI-friendly mode (no colors, no prompts, warnings don't fail)")
  .option("--deep", "Run deep checks like tsc validation")
  .option("--verbose", "Verbose logging")
  .option("--profile", "Enable detailed performance profiling")
  .option("--trace", "Output trace tree showing spans and durations")
  .option("--metrics <format>", "Output performance metrics (format: json)")
  .option("--log-data <mode>", "Log data introspection mode: off, summary, full")
  .option("--redact <keys>", "Additional comma-separated keys to redact")
  .option("--no-redact", "Disable redaction (local development only)")
  .action(async (opts) => {
    await runCommand(
      "doctor",
      async ({ logger }) => {
        logger.debug({ opts }, "Doctor command options");
        const exitCode = await runDoctor({
          ...opts,
          silent: opts.metrics === "json",
        });

        // In CI mode, treat warnings (exit 1) as success
        // This makes the tool more CI-friendly - only fail on actual errors
        const isCI = opts.ci || process.env.CI;
        const shouldFail = isCI ? exitCode >= 2 : exitCode !== 0;

        // If exitCode is non-zero and should fail, throw an error with the exitCode property
        // This allows runCommand to finish, log profile, and set proper exit code
        if (shouldFail) {
          const err = new Error(
            exitCode === 1 ? "Doctor found warnings" : "Doctor found failures"
          ) as Error & { exitCode: number };
          err.exitCode = exitCode;
          throw err;
        }
      },
      {
        verbose: !!opts.verbose,
        silent: opts.json || opts.metrics === "json",
        profile: opts.profile,
        trace: opts.trace,
        metricsJson: opts.metrics === "json",
        logData: opts.logData,
        redact: opts.redact,
        noRedact: opts.noRedact === true,
      }
    );
  });
