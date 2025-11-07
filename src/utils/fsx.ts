import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { Logger } from "pino";

import { compactDiff } from "./diff.js";
import { logData, isTextLike } from "./log-data.js";
import type { Profiler } from "./profiler.js";

/**
 * Ensure directory exists, creating it recursively if needed.
 */
export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

/**
 * Check if a file or directory exists.
 */
export async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read text file content.
 */
export async function readText(p: string, profiler?: Profiler): Promise<string> {
  const content = await fs.readFile(p, "utf8");
  if (profiler) {
    profiler.bumpRead(Buffer.byteLength(content, "utf8"));
  }
  return content;
}

/**
 * Write text file content.
 */
export async function writeText(p: string, s: string, profiler?: Profiler): Promise<void> {
  await fs.writeFile(p, s, "utf8");
  if (profiler) {
    profiler.bumpWrite(Buffer.byteLength(s, "utf8"));
  }
}

/**
 * Write file only if it doesn't exist.
 * Returns true if file was created, false if it already existed.
 */
export async function writeIfAbsent(
  file: string,
  contents: string,
  profiler?: Profiler
): Promise<boolean> {
  try {
    await fs.access(file);
    return false; // file exists
  } catch {
    // file doesn't exist, create it
    await ensureDir(path.dirname(file));
    await writeText(file, contents, profiler);
    return true;
  }
}

/**
 * Write file safely with force option.
 * If file exists and force is false, no-op.
 * If force is true, overwrite the file.
 */
export async function safeWrite(
  file: string,
  contents: string,
  options: { force?: boolean; profiler?: Profiler; logger?: Logger } = {}
): Promise<void> {
  const { force, profiler, logger } = options;

  // Read old content if updating (only for text files)
  let oldContent: string | null = null;
  if (force) {
    const fileExists = await exists(file);
    if (fileExists && isTextLike(file)) {
      try {
        oldContent = await readText(file);
      } catch {
        // Ignore read errors for diff
      }
    }
  } else {
    const fileExists = await exists(file);
    if (fileExists) {
      return; // skip if exists and not forcing
    }
  }

  await ensureDir(path.dirname(file));
  await writeText(file, contents, profiler);

  // Log post-write confirmation and diff
  if (logger) {
    const bytes = Buffer.byteLength(contents, "utf8");
    const hash = crypto
      .createHash("sha256")
      .update(contents, "utf8")
      .digest("hex")
      .substring(0, 16);

    // Log diff if updating
    if (oldContent !== null) {
      const hunks = compactDiff(oldContent, contents);
      if (hunks.length > 0) {
        logData(logger, `file.diff:${path.basename(file)}`, { path: file, hunks });
      }
    }

    // Log file write confirmation with actual stats
    logData(logger, `file.confirm:${path.basename(file)}`, {
      path: file,
      bytes,
      hash,
    });
  }
}
