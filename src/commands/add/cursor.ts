import fs from "node:fs/promises";
import path from "node:path";

import type { Command } from "commander";

import { phaseTemplate } from "../../templates/cursor/phaseTemplate.js";
import { rulesTemplate } from "../../templates/cursor/rulesTemplate.js";

/** Write a file if missing, unless --force is set. */
async function writeIfAbsent(filePath: string, contents: string, force = false): Promise<void> {
  const relPath = path.relative(process.cwd(), filePath);

  try {
    if (!force) {
      await fs.access(filePath);
      console.log(`skip   ${relPath} (exists)`);
      return; // file exists, skip
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
}

export function registerAddCursor(program: Command) {
  program
    .command("add:cursor")
    .description("Create Cursor AI rule files and phase prompts")
    .argument("<type>", "Type: 'rules' or 'phase'")
    .option("--name <string>", "Name for rules file (required for type 'rules')")
    .option("--phase <number>", "Phase number (required for type 'phase')")
    .option("--force", "Overwrite existing files", false)
    .action(
      async (
        type: string,
        opts: {
          name?: string;
          phase?: string;
          force?: boolean;
        }
      ) => {
        try {
          // Validate type
          if (type !== "rules" && type !== "phase") {
            throw new Error("Invalid cursor type. Use 'rules' or 'phase'.");
          }

          const baseDir = path.resolve(process.cwd(), ".nextforge/cursor");

          if (type === "rules") {
            // Validate required --name flag
            if (!opts.name) {
              throw new Error("--name is required for type 'rules'");
            }

            const filePath = path.join(baseDir, "rules", `${opts.name}.rules.md`);
            const content = rulesTemplate(opts.name);
            await writeIfAbsent(filePath, content, !!opts.force);
          } else if (type === "phase") {
            // Validate required --phase flag
            if (!opts.phase) {
              throw new Error("--phase is required for type 'phase'");
            }

            const phaseNum = parseInt(opts.phase, 10);
            if (isNaN(phaseNum) || phaseNum < 1) {
              throw new Error("--phase must be a positive number");
            }

            const filePath = path.join(baseDir, "phases", `phase-${phaseNum}.md`);
            const content = phaseTemplate(phaseNum);
            await writeIfAbsent(filePath, content, !!opts.force);
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
