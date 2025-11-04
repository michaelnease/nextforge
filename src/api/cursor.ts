import fs from "node:fs/promises";
import path from "node:path";

import { phaseTemplate } from "../templates/cursor/phaseTemplate.js";
import { rulesTemplate } from "../templates/cursor/rulesTemplate.js";
import { loadConfig } from "../utils/loadConfig.js";

/**
 * Validate that a name is in valid kebab-case format.
 */
function isKebabCase(name: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name);
}

type CursorIndexEntry = {
  name: string;
  type: "rules" | "phases";
  format: "json" | "mdx";
  file: string;
  createdAt: string;
};

/**
 * Update the index.json file to track generated files.
 */
async function updateIndex(
  baseDir: string,
  entry: Omit<CursorIndexEntry, "createdAt">
): Promise<void> {
  const indexPath = path.join(baseDir, "index.json");
  let list: CursorIndexEntry[] = [];

  try {
    const content = await fs.readFile(indexPath, "utf8");
    list = JSON.parse(content);
    if (!Array.isArray(list)) {
      list = [];
    }
  } catch {
    // File doesn't exist or is invalid
  }

  const existingIndex = list.findIndex((item) => item.file === entry.file);
  const fullEntry: CursorIndexEntry = {
    ...entry,
    createdAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    const existing = list[existingIndex];
    if (existing) {
      fullEntry.createdAt = existing.createdAt;
    }
    list[existingIndex] = fullEntry;
  } else {
    list.push(fullEntry);
  }

  list.sort((a, b) => a.name.localeCompare(b.name));
  await fs.writeFile(indexPath, JSON.stringify(list, null, 2) + "\n", "utf8");
}

/**
 * Write a file if missing, unless force is set.
 */
async function writeIfAbsent(filePath: string, contents: string, force = false): Promise<boolean> {
  try {
    if (!force) {
      await fs.access(filePath);
      return false; // file exists, skip
    }
  } catch {
    // file missing, will write
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents, "utf8");
  return true;
}

export type CreateCursorRulesOptions = {
  /**
   * Name for the rules file (must be kebab-case)
   * @example "component-rules"
   */
  name: string;
  /**
   * Output format (default: "json")
   */
  format?: "json" | "mdx";
  /**
   * Working directory (default: process.cwd())
   */
  cwd?: string;
  /**
   * Overwrite existing file (default: false)
   */
  force?: boolean;
  /**
   * Custom cursor directory (overrides config; default: .nextforge/cursor)
   */
  cursorDir?: string;
};

/**
 * Create Cursor AI rules file programmatically.
 * Can be called from other commands like add:component.
 *
 * @throws Error if name is invalid or file operation fails
 * @returns Path to the created file
 *
 * @example
 * ```ts
 * import { createCursorRules } from "./api/cursor.js";
 *
 * const filePath = await createCursorRules({
 *   name: "component-rules",
 *   format: "json",
 *   force: false
 * });
 * ```
 */
export async function createCursorRules(opts: CreateCursorRulesOptions): Promise<string> {
  const { name, format = "json", cwd = process.cwd(), force = false, cursorDir } = opts;

  // Validate name is kebab-case
  if (!isKebabCase(name)) {
    throw new Error('Invalid --name. Use kebab-case (e.g. "component-rules")');
  }

  // Load config and determine output directory
  const config = await loadConfig({ cwd });
  const baseCursorDir = cursorDir ?? config.cursorDir ?? ".nextforge/cursor";
  const baseDir = path.resolve(cwd, baseCursorDir);

  // Ensure base directory exists
  await fs.mkdir(baseDir, { recursive: true });

  const ext = format === "mdx" ? ".mdx" : ".json";
  const folder = "rules";
  const fileName = `${name}.rules${ext}`;
  const filePath = path.join(baseDir, folder, fileName);
  const content = rulesTemplate({ name, format });

  const wasWritten = await writeIfAbsent(filePath, content, force);

  if (wasWritten) {
    // Use POSIX paths in index
    const indexFile = path.posix.join(baseCursorDir, folder, fileName);
    await updateIndex(baseDir, {
      type: folder,
      name,
      file: indexFile,
      format,
    });
  }

  return filePath;
}

export type CreateCursorPhaseOptions = {
  /**
   * Phase number (must be positive integer)
   * @example 1
   */
  phase: number;
  /**
   * Output format (default: "json")
   */
  format?: "json" | "mdx";
  /**
   * Working directory (default: process.cwd())
   */
  cwd?: string;
  /**
   * Overwrite existing file (default: false)
   */
  force?: boolean;
  /**
   * Custom cursor directory (overrides config; default: .nextforge/cursor)
   */
  cursorDir?: string;
};

/**
 * Create Cursor AI phase prompt programmatically.
 * Can be called from other commands or scripts.
 *
 * @throws Error if phase is invalid or file operation fails
 * @returns Path to the created file
 *
 * @example
 * ```ts
 * import { createCursorPhase } from "./api/cursor.js";
 *
 * const filePath = await createCursorPhase({
 *   phase: 1,
 *   format: "json"
 * });
 * ```
 */
export async function createCursorPhase(opts: CreateCursorPhaseOptions): Promise<string> {
  const { phase, format = "json", cwd = process.cwd(), force = false, cursorDir } = opts;

  // Validate phase is positive integer
  if (!Number.isInteger(phase) || phase < 1) {
    throw new Error("Invalid --phase. Provide a positive integer (e.g. --phase 3)");
  }

  // Load config and determine output directory
  const config = await loadConfig({ cwd });
  const baseCursorDir = cursorDir ?? config.cursorDir ?? ".nextforge/cursor";
  const baseDir = path.resolve(cwd, baseCursorDir);

  // Ensure base directory exists
  await fs.mkdir(baseDir, { recursive: true });

  const ext = format === "mdx" ? ".mdx" : ".json";
  const folder = "phases";
  const fileName = `phase-${phase}${ext}`;
  const filePath = path.join(baseDir, folder, fileName);
  const content = phaseTemplate({ phase, format });

  const wasWritten = await writeIfAbsent(filePath, content, force);

  if (wasWritten) {
    // Use POSIX paths in index
    const indexFile = path.posix.join(baseCursorDir, folder, fileName);
    await updateIndex(baseDir, {
      type: folder,
      name: `phase-${phase}`,
      file: indexFile,
      format,
    });
  }

  return filePath;
}
