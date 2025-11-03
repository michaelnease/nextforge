import fs from "node:fs/promises";
import path from "node:path";

import type { Command } from "commander";

import { phaseTemplate } from "../../templates/cursor/phaseTemplate.js";
import { rulesTemplate } from "../../templates/cursor/rulesTemplate.js";
import { loadConfig } from "../../utils/loadConfig.js";

/**
 * Normalize a name to kebab-case for use in filenames.
 * @throws Error if name is empty or invalid after normalization
 */
function normalizeName(raw: string): string {
  const base = raw.trim();
  if (!base) {
    throw new Error("Name cannot be empty");
  }

  // Convert to kebab-case for filenames
  const slug = base
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  if (!slug) {
    throw new Error("Invalid name - must contain at least one alphanumeric character");
  }

  return slug;
}

/**
 * Write a file if missing, unless --force is set.
 * Returns true if the file was written, false if skipped.
 */
async function writeIfAbsent(filePath: string, contents: string, force = false): Promise<boolean> {
  const relPath = path.relative(process.cwd(), filePath);

  try {
    if (!force) {
      await fs.access(filePath);
      console.log(`skip   ${relPath} (exists)`);
      return false; // file exists, skip
    }
  } catch {
    // file missing, will write
  }

  // Ensure parent directory exists
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  // Write file
  await fs.writeFile(filePath, contents, "utf8");

  if (force) {
    console.log(`force overwrite -> ${relPath}`);
  } else {
    console.log(`write  ${relPath}`);
  }

  return true;
}

/**
 * Update the index.json file to track generated files.
 */
async function updateIndex(
  baseDir: string,
  entry: { type: string; name: string; file: string }
): Promise<void> {
  const indexPath = path.join(baseDir, "index.json");
  let list: Array<{ type: string; name: string; file: string }> = [];

  try {
    const content = await fs.readFile(indexPath, "utf8");
    list = JSON.parse(content);
  } catch {
    // File doesn't exist or is invalid, start fresh
  }

  // Add new entry (avoid duplicates based on file path)
  const existingIndex = list.findIndex((item) => item.file === entry.file);
  if (existingIndex >= 0) {
    list[existingIndex] = entry;
  } else {
    list.push(entry);
  }

  await fs.writeFile(indexPath, JSON.stringify(list, null, 2), "utf8");
}

export function registerAddCursor(program: Command) {
  program
    .command("add:cursor")
    .description("Generate Cursor rules or phase prompts for Cursor AI")
    .argument("<type>", 'Type: "rules" or "phase"')
    .option("--name <string>", "Name for rules file (required for type 'rules')")
    .option("--phase <number>", "Phase number (required for type 'phase')")
    .option("--mdx", "Write as .mdx instead of .md", false)
    .option("-f, --force", "Overwrite existing files", false)
    .action(
      async (
        type: string,
        opts: {
          name?: string;
          phase?: string;
          mdx?: boolean;
          force?: boolean;
        }
      ) => {
        try {
          // Validate type
          if (type !== "rules" && type !== "phase") {
            throw new Error('Invalid --type. Use "rules" or "phase".');
          }

          // Load config to get custom cursorDir if specified
          const config = await loadConfig({ cwd: process.cwd() });
          const baseDir = path.resolve(process.cwd(), config.cursorDir);

          // Determine file extension
          const ext = opts.mdx ? ".mdx" : ".md";

          if (type === "rules") {
            // Validate required --name flag
            if (opts.name === undefined) {
              throw new Error("--name is required for type 'rules'");
            }

            // Validate and normalize name (throws if empty or invalid)
            const name = normalizeName(opts.name);

            const folder = "rules";
            const fileName = `${name}.rules${ext}`;
            const filePath = path.join(baseDir, folder, fileName);
            const content = rulesTemplate(name);

            const wasWritten = await writeIfAbsent(filePath, content, !!opts.force);

            if (wasWritten) {
              // Update index
              await updateIndex(baseDir, {
                type: folder,
                name,
                file: path.relative(process.cwd(), filePath),
              });

              // Success message
              console.log(
                "\nNext: Add this file to Cursor Settings → Rules → Add `.cursor/rules/...` or paste the rules directly into a Cursor tab."
              );
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
            const content = phaseTemplate(phaseNum);

            const wasWritten = await writeIfAbsent(filePath, content, !!opts.force);

            if (wasWritten) {
              // Update index
              await updateIndex(baseDir, {
                type: folder,
                name: `phase-${phaseNum}`,
                file: path.relative(process.cwd(), filePath),
              });

              // Success message
              console.log(
                `\nNext: Open the file and run the Phase ${phaseNum} prompt in Cursor to start implementation.`
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
