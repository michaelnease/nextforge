import { randomUUID } from "node:crypto";
import os from "node:os";

import type { Logger } from "pino";

import { setLogDataMode, setExtraRedactKeys, logData, type LogDataMode } from "./log-data.js";
import { createLogger } from "./logger.js";
import { Profiler, formatProfileSummary, type ProfileSummary } from "./profiler.js";

export interface RunCommandOptions {
  verbose?: boolean | undefined;
  silent?: boolean | undefined; // Only log to file, not console
  profile?: boolean | undefined; // Enable detailed profiling
  metricsJson?: boolean | undefined; // Output metrics as JSON only
  logData?: string | undefined; // Data introspection mode
  redact?: string | undefined; // Additional keys to redact
  noRedact?: boolean | undefined; // Disable redaction
}

export interface CommandContext {
  logger: Logger;
  profiler: Profiler;
}

/**
 * Wrapper for command execution that provides structured logging and profiling
 * Logs start, end, duration, success/failure, and any errors
 * Optionally collects detailed performance metrics
 */
export async function runCommand<T = void>(
  commandName: string,
  action: (ctx: CommandContext) => Promise<T> | T,
  options: RunCommandOptions = {}
): Promise<T> {
  const runId = randomUUID();
  const startTime = Date.now();

  // Set up log data mode
  if (
    options.logData &&
    (options.logData === "off" || options.logData === "summary" || options.logData === "full")
  ) {
    setLogDataMode(options.logData as LogDataMode);
  }

  // Set up extra redact keys
  if (options.redact) {
    const extraKeys = options.redact.split(",").map((k) => k.trim());
    setExtraRedactKeys(extraKeys);
  }

  // Set no-redact env var if requested
  if (options.noRedact) {
    process.env.NEXTFORGE_NO_REDACT = "1";
  }

  // Check for profiling env var
  const enableProfiling =
    options.profile ||
    process.env.NEXTFORGE_PROFILE === "1" ||
    process.env.NEXTFORGE_PROFILE === "true";

  // Check for metrics JSON env var
  const metricsJson = options.metricsJson || process.env.NEXTFORGE_METRICS === "json";

  // Create profiler with metadata
  const profiler = new Profiler(commandName, enableProfiling, {
    version: process.env.npm_package_version,
    nodeVersion: process.version,
    platform: `${os.platform()}-${os.arch()}`,
  });

  // Create contextual logger
  const logger = createLogger({
    cmd: commandName,
    runId,
    verbose: options.verbose,
    silent: options.silent || metricsJson, // Silent if outputting metrics JSON
  });

  if (!metricsJson) {
    logger.info({ event: "start" }, `Starting command: ${commandName}`);
  }

  // Log command inputs
  logData(logger, "inputs", {
    command: commandName,
    runId,
    env: {
      NODE_ENV: process.env.NODE_ENV,
      CI: process.env.CI,
    },
    platform: `${os.platform()}-${os.arch()}`,
    nodeVersion: process.version,
  });

  let profile: ProfileSummary | undefined;

  try {
    // Execute the command action
    const result = await action({ logger, profiler });

    // Calculate duration
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Set explicit exit code for success
    process.exitCode = 0;

    // Finish profiling
    profile = profiler.finish(true);

    // Output metrics JSON if requested
    if (metricsJson) {
      console.log(JSON.stringify(profile, null, 2));
      return result;
    }

    // Log success with profile summary
    logger.info(
      {
        event: "finished",
        ok: true,
        duration: `${duration}s`,
        exitCode: 0,
        profile,
      },
      `Command completed successfully in ${duration}s`
    );

    // Log human-readable profile summary if profiling enabled
    if (enableProfiling && !options.silent) {
      console.log("\nPerformance Profile:");
      console.log(formatProfileSummary(profile));
    }

    return result;
  } catch (err) {
    // Calculate duration
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Determine exit code from error if available
    const exitCode =
      (err as Error & { exitCode?: number; code?: number })?.exitCode ||
      (err as Error & { exitCode?: number; code?: number })?.code ||
      1;

    // Finish profiling with error
    profile = profiler.finish(false, err);

    // Output metrics JSON if requested
    if (metricsJson) {
      console.log(JSON.stringify(profile, null, 2));
      process.exitCode = exitCode;
      return undefined as unknown as T; // Exit with JSON only, no error output
    }

    // Build structured error object
    const errorObj: {
      message: string;
      stack?: string | undefined;
      code?: string | number | undefined;
      cause?: unknown;
    } = {
      message: err instanceof Error ? err.message : String(err),
    };

    // Only include stack trace for actual errors (exit code >= 2), not warnings
    if (exitCode >= 2 && err instanceof Error && err.stack) {
      errorObj.stack = err.stack;
    }

    // Include error code if available
    if ((err as Error & { code?: string | number })?.code) {
      errorObj.code = (err as Error & { code?: string | number }).code;
    }

    // Include cause if available (Node.js 16.9+)
    if (err instanceof Error && "cause" in err) {
      errorObj.cause = err.cause;
    }

    // Log at appropriate level based on exit code
    // Exit code 1 = warnings (non-critical), >= 2 = failures (critical)
    const logLevel = exitCode === 1 ? logger.warn : logger.error;
    const eventName = exitCode === 1 ? "warning" : "error";
    const statusMessage = exitCode === 1 ? "completed with warnings" : "failed";

    logLevel.call(
      logger,
      {
        event: eventName,
        ok: false,
        duration: `${duration}s`,
        exitCode,
        error: errorObj,
        profile,
      },
      `Command ${statusMessage} after ${duration}s: ${err instanceof Error ? err.message : String(err)}`
    );

    // Log human-readable profile summary if profiling enabled
    if (enableProfiling && !options.silent) {
      const profileLabel =
        exitCode === 1 ? "Performance Profile (warnings):" : "Performance Profile (failed):";
      console.log(`\n${profileLabel}`);
      console.log(formatProfileSummary(profile));
    }

    // Set process exit code
    process.exitCode = exitCode;

    // Don't re-throw - we've logged the error and set exit code
    // Commands can check process.exitCode if needed
    return undefined as unknown as T;
  }
}
