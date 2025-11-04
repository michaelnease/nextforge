import fs from "node:fs/promises";
import path from "node:path";

import type { Command } from "commander";

import { phaseTemplate } from "../../templates/cursor/phaseTemplate.js";
import { rulesTemplate } from "../../templates/cursor/rulesTemplate.js";
import { loadConfig } from "../../utils/loadConfig.js";

/**
 * Validate that a name is in valid kebab-case format.
 * Only allows lowercase letters, numbers, and hyphens (no leading/trailing hyphens).
 */
function isKebabCase(name: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name);
}

/**
 * Normalize a name to kebab-case for use in filenames.
 * Removes quotes, converts to lowercase, replaces non-alphanumeric with dashes.
 * @throws Error if name is empty or invalid after normalization
 */
function normalizeName(raw: string): string {
  const slug = raw
    .trim()
    .replace(/['"`]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .replace(/-+/g, "-");

  if (!slug || !isKebabCase(slug)) {
    throw new Error('Invalid --name. Use kebab-case, e.g. "cursor-rules"');
  }

  return slug;
}

/**
 * Write a file if missing, unless --force is set.
 * Returns true if the file was written, false if skipped.
 */
async function writeIfAbsent(filePath: string, contents: string, force = false): Promise<boolean> {
  const relPath = path.posix.normalize(path.relative(process.cwd(), filePath));

  try {
    if (!force) {
      await fs.access(filePath);
      console.log(`skip   ${relPath} (exists)`);
      return false;
    }
  } catch {
    // file missing, will write
  }

  // Ensure parent directory exists
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  // Write file with trailing newline
  await fs.writeFile(filePath, contents, "utf8");

  if (force) {
    console.log(`force overwrite -> ${relPath}`);
  } else {
    console.log(`write  ${relPath}`);
  }

  return true;
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
 * Handles corrupt or missing index gracefully.
 * Stores entries sorted by name for clean diffs.
 */
async function updateIndex(
  baseDir: string,
  entry: Omit<CursorIndexEntry, "createdAt">
): Promise<void> {
  const indexPath = path.join(baseDir, "index.json");
  let list: CursorIndexEntry[] = [];

  // Load existing index, handle corrupt JSON gracefully
  try {
    const content = await fs.readFile(indexPath, "utf8");
    list = JSON.parse(content);
    if (!Array.isArray(list)) {
      console.warn("Warning: index.json is not an array, resetting");
      list = [];
    }
  } catch {
    // File doesn't exist or is invalid, start fresh
  }

  // Upsert by file path (avoid duplicates)
  const existingIndex = list.findIndex((item) => item.file === entry.file);
  const fullEntry: CursorIndexEntry = {
    ...entry,
    createdAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    // Preserve original createdAt on updates
    const existing = list[existingIndex];
    if (existing) {
      fullEntry.createdAt = existing.createdAt;
    }
    list[existingIndex] = fullEntry;
  } else {
    list.push(fullEntry);
  }

  // Sort by name for clean diffs
  list.sort((a, b) => a.name.localeCompare(b.name));

  // Write with trailing newline
  await fs.writeFile(indexPath, JSON.stringify(list, null, 2) + "\n", "utf8");
}

export function registerAddCursor(program: Command) {
  program
    .command("add:cursor")
    .description("Generate Cursor rules or phase prompts for Cursor AI")
    .argument("<type>", 'Type: "rules" or "phase"')
    .option("--name <string>", "Name for rules file (required for rules type, kebab-case)")
    .option("--phase <number>", "Phase number (required for phase type, must be positive)")
    .option("--mdx", "Use MDX format instead of JSON (default: JSON)", false)
    .option(
      "--cursor-dir <dir>",
      "Custom output directory (overrides config; default: .nextforge/cursor)"
    )
    .option("-f, --force", "Overwrite existing files", false)
    .addHelpText(
      "after",
      `
Directory precedence: --cursor-dir > config.cursorDir > .nextforge/cursor

Examples:
  $ nextforge add:cursor rules --name audit-trace
  $ nextforge add:cursor rules --name perf-budget --mdx
  $ nextforge add:cursor phase --phase 1
  $ nextforge add:cursor rules --name security --cursor-dir .cursor/custom
  $ nextforge add:cursor rules --name api-design --force
`
    )
    .action(
      async (
        type: string,
        opts: {
          name?: string;
          phase?: string;
          mdx?: boolean;
          cursorDir?: string;
          force?: boolean;
        }
      ) => {
        try {
          // Validate type
          if (!["rules", "phase"].includes(type)) {
            throw new Error('Invalid type. Use one of: "rules", "phase"');
          }

          // Load config to get custom cursorDir if specified
          const config = await loadConfig({ cwd: process.cwd() });

          // Precedence: CLI flag > config > default
          // Resolve from cwd to handle relative paths consistently
          const baseCursorDir = opts.cursorDir ?? config.cursorDir ?? ".nextforge/cursor";
          const baseDir = path.resolve(process.cwd(), baseCursorDir);

          // Ensure base directory exists
          await fs.mkdir(baseDir, { recursive: true });

          // Determine format and file extension
          const format = opts.mdx ? "mdx" : "json";
          const ext = opts.mdx ? ".mdx" : ".json";

          if (type === "rules") {
            // Validate required --name flag
            if (!opts.name || !opts.name.trim()) {
              throw new Error("Missing --name for rules");
            }

            // First validate that input is already in kebab-case or can be converted
            if (!isKebabCase(opts.name)) {
              if (opts.name !== opts.name.toLowerCase()) {
                // Input contains uppercase - reject it
                throw new Error('Invalid --name. Use kebab-case, e.g. "cursor-rules"');
              }
              if (opts.name.includes("_")) {
                // Input contains underscores - reject it
                throw new Error('Invalid --name. Use kebab-case, e.g. "cursor-rules"');
              }
            }

            // Validate and normalize name (throws if invalid)
            const name = normalizeName(opts.name);

            const folder = "rules";
            const fileName = `${name}.rules${ext}`;
            const filePath = path.join(baseDir, folder, fileName);
            const content = rulesTemplate({ name, format });

            const wasWritten = await writeIfAbsent(filePath, content, !!opts.force);

            if (wasWritten) {
              // Use POSIX paths in index for cross-platform compatibility
              const indexFile = path.posix.join(baseCursorDir, folder, fileName);

              // Update index
              await updateIndex(baseDir, {
                type: folder,
                name,
                file: indexFile,
                format,
              });

              console.log(
                `\nCreated: ${path.posix.normalize(path.relative(process.cwd(), filePath))}`
              );
              console.log(
                `Indexed: ${path.posix.normalize(path.relative(process.cwd(), path.join(baseDir, "index.json")))} (format=${format}, type=${folder})`
              );
              console.log("\nNext in Cursor:");
              console.log('1) Open Settings → Rules → "+ New Rule"');
              console.log(`2) Paste the ${format.toUpperCase()} contents, name it "${name}"`);
              console.log("3) Save and pin to workspace");
            }
          } else if (type === "phase") {
            // Validate required --phase flag
            if (!opts.phase) {
              throw new Error("--phase is required for type 'phase'");
            }

            const phaseNum = parseInt(opts.phase, 10);
            if (isNaN(phaseNum) || phaseNum < 1) {
              throw new Error("--phase must be a positive integer");
            }

            const folder = "phases";
            const fileName = `phase-${phaseNum}${ext}`;
            const filePath = path.join(baseDir, folder, fileName);
            const content = phaseTemplate({ phase: phaseNum, format });

            const wasWritten = await writeIfAbsent(filePath, content, !!opts.force);

            if (wasWritten) {
              // Use POSIX paths in index for cross-platform compatibility
              const indexFile = path.posix.join(baseCursorDir, folder, fileName);

              // Update index
              await updateIndex(baseDir, {
                type: folder,
                name: `phase-${phaseNum}`,
                file: indexFile,
                format,
              });

              console.log(
                `\nCreated: ${path.posix.normalize(path.relative(process.cwd(), filePath))}`
              );
              console.log(
                `Indexed: ${path.posix.normalize(path.relative(process.cwd(), path.join(baseDir, "index.json")))} (format=${format}, type=${folder})`
              );
              console.log(
                `\nNext: Open the file and run the Phase ${phaseNum} checklist in Cursor.`
              );
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`add:cursor failed: ${msg}`);
          process.exitCode = 1;
          throw err; // Re-throw for tests
        }
      }
    );
}
