import fs from "node:fs/promises";
import path from "node:path";

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
export async function readText(p: string): Promise<string> {
  return await fs.readFile(p, "utf8");
}

/**
 * Write text file content.
 */
export async function writeText(p: string, s: string): Promise<void> {
  await fs.writeFile(p, s, "utf8");
}

/**
 * Write file only if it doesn't exist.
 * Returns true if file was created, false if it already existed.
 */
export async function writeIfAbsent(file: string, contents: string): Promise<boolean> {
  try {
    await fs.access(file);
    return false; // file exists
  } catch {
    // file doesn't exist, create it
    await ensureDir(path.dirname(file));
    await writeText(file, contents);
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
  { force }: { force?: boolean } = {}
): Promise<void> {
  if (!force) {
    const fileExists = await exists(file);
    if (fileExists) {
      return; // skip if exists and not forcing
    }
  }
  await ensureDir(path.dirname(file));
  await writeText(file, contents);
}
