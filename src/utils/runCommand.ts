import { randomUUID } from "node:crypto";

import type { Logger } from "pino";

import { createLogger } from "./logger.js";

export interface RunCommandOptions {
  verbose?: boolean | undefined;
  silent?: boolean | undefined; // Only log to file, not console
}

/**
 * Wrapper for command execution that provides structured logging
 * Logs start, end, duration, success/failure, and any errors
 */
export async function runCommand<T = void>(
  commandName: string,
  action: (logger: Logger) => Promise<T> | T,
  options: RunCommandOptions = {}
): Promise<T> {
  const runId = randomUUID();
  const startTime = Date.now();

  // Create contextual logger
  const logger = createLogger({
    cmd: commandName,
    runId,
    verbose: options.verbose,
    silent: options.silent,
  });

  logger.info({ event: "start" }, `Starting command: ${commandName}`);

  try {
    // Execute the command action
    const result = await action(logger);

    // Calculate duration
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Log success
    logger.info(
      {
        event: "finished",
        ok: true,
        duration: `${duration}s`,
        exitCode: 0,
      },
      `Command completed successfully in ${duration}s`
    );

    return result;
  } catch (err) {
    // Calculate duration
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Determine exit code from error if available
    const exitCode = (err as any)?.exitCode || (err as any)?.code || 1;

    // Log error with stack trace
    logger.error(
      {
        event: "error",
        ok: false,
        duration: `${duration}s`,
        exitCode,
        error: {
          message: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        },
      },
      `Command failed after ${duration}s: ${err instanceof Error ? err.message : String(err)}`
    );

    // Set process exit code
    process.exitCode = exitCode;

    // Re-throw so the command can handle it
    throw err;
  }
}
