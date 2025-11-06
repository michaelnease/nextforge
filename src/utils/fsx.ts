import fs from "node:fs/promises";
import path from "node:path";

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
  options: { force?: boolean; profiler?: Profiler } = {}
): Promise<void> {
  const { force, profiler } = options;
  if (!force) {
    const fileExists = await exists(file);
    if (fileExists) {
      return; // skip if exists and not forcing
    }
  }
  await ensureDir(path.dirname(file));
  await writeText(file, contents, profiler);
}
