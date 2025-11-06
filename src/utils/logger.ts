import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

import pino from "pino";
import type { Logger } from "pino";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get package version
function getVersion(): string {
  try {
    const pkgPath = path.join(__dirname, "../../package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    return pkg.version || "unknown";
  } catch {
    return "unknown";
  }
}

// Get git SHA if available
function getGitSha(): string | undefined {
  try {
    const gitHeadPath = path.join(process.cwd(), ".git", "HEAD");
    if (!fs.existsSync(gitHeadPath)) return undefined;

    const head = fs.readFileSync(gitHeadPath, "utf8").trim();
    if (head.startsWith("ref:")) {
      const refPath = head.substring(5).trim();
      const refFile = path.join(process.cwd(), ".git", refPath);
      if (fs.existsSync(refFile)) {
        return fs.readFileSync(refFile, "utf8").trim().substring(0, 8);
      }
      return undefined;
    } else {
      return head.substring(0, 8);
    }
  } catch {
    return undefined;
  }
}

// Check if running in CI
function isCI(): boolean {
  return !!(
    process.env.CI ||
    process.env.CONTINUOUS_INTEGRATION ||
    process.env.BUILD_NUMBER ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.CIRCLECI
  );
}

// Get log level from env or flag
export function getLogLevel(): pino.Level {
  const level = process.env.NEXTFORGE_LOG_LEVEL?.toLowerCase();
  if (
    level === "error" ||
    level === "warn" ||
    level === "info" ||
    level === "debug" ||
    level === "trace"
  ) {
    return level;
  }
  return "info";
}

export interface LoggerContext {
  cmd?: string;
  runId?: string;
  verbose?: boolean | undefined;
  silent?: boolean | undefined; // Only log to file, not console
}

let logDir: string | null = null;

// Ensure log directory exists
function ensureLogDir(): string {
  if (logDir) return logDir;

  const dir = path.join(process.cwd(), ".nextforge", "logs");
  try {
    fs.mkdirSync(dir, { recursive: true });
    logDir = dir;
  } catch (err) {
    console.warn(`Failed to create log directory: ${err}`);
    // Fallback to temp directory
    logDir = path.join(os.tmpdir(), "nextforge-logs");
    fs.mkdirSync(logDir, { recursive: true });
  }
  return logDir;
}

// Get log file path for today
function getLogFilePath(): string {
  const dir = ensureLogDir();
  const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  return path.join(dir, `${date}.log`);
}

/**
 * Create a contextual logger with Pino
 */
export function createLogger(ctx: LoggerContext = {}): Logger {
  const version = getVersion();
  const nodeVersion = process.version;
  const platform = `${os.platform()}-${os.arch()}`;
  const gitSha = getGitSha();
  const ci = isCI();

  // Determine log level
  let level = getLogLevel();
  if (ctx.verbose) {
    level = "debug";
  }

  // Base context for all logs
  const baseContext = {
    version,
    nodeVersion,
    platform,
    ...(gitSha && { gitSha }),
    ...(ctx.cmd && { cmd: ctx.cmd }),
    ...(ctx.runId && { runId: ctx.runId }),
  };

  // Create file stream for rotating logs (async, non-blocking)
  const logFilePath = getLogFilePath();
  const fileStream = fs.createWriteStream(logFilePath, { flags: "a" });

  // For CI or when stdout is not a TTY, use plain JSON
  const usePlainJson = ci || !process.stdout.isTTY;

  let logger: Logger;

  // If silent mode, only log to file
  if (ctx.silent) {
    logger = pino(
      {
        level,
        base: baseContext,
        timestamp: pino.stdTimeFunctions.isoTime,
      },
      fileStream
    );
  } else if (usePlainJson) {
    // Plain JSON output for CI
    logger = pino(
      {
        level,
        base: baseContext,
        timestamp: pino.stdTimeFunctions.isoTime,
      },
      pino.multistream([
        { stream: process.stdout },
        { stream: fileStream, level: "debug" }, // Always write debug+ to file
      ])
    );
  } else {
    // Pretty console output for development
    const prettyStream = pino.transport({
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss",
        ignore: "pid,hostname,version,nodeVersion,platform,gitSha",
        messageFormat: "{if cmd}[{cmd}] {end}{msg}",
      },
    });

    logger = pino(
      {
        level,
        base: baseContext,
      },
      pino.multistream([
        { stream: prettyStream },
        { stream: fileStream, level: "debug" }, // Always write debug+ to file
      ])
    );
  }

  return logger;
}
