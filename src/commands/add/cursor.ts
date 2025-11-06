import fs from "node:fs/promises";
import path from "node:path";

import type { Command } from "commander";

import {
  createCursorPhase,
  createCursorRules,
  isKebabCase,
  normalizeName,
} from "../../api/cursor.js";
import { loadConfig } from "../../config/loadConfig.js";

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
Subtypes:
  rules   Generate Cursor AI rules file (requires --name)
  phase   Generate phase implementation guide (requires --phase)

Directory precedence:
  --cursor-dir > config.cursorDir > .nextforge/cursor

Examples:
  $ nextforge add:cursor rules --name component-rules --format json
  $ nextforge add:cursor rules --name api-guidelines --mdx
  $ nextforge add:cursor phase --phase 1 --format json
  $ nextforge add:cursor phase --phase 2 --mdx --force
  $ nextforge add:cursor rules --name security --cursor-dir .cursor/custom
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

          // Determine format
          const format = opts.mdx ? "mdx" : "json";

          if (type === "rules") {
            // Validate required --name flag
            if (!opts.name || !opts.name.trim()) {
              throw new Error("Missing --name for rules");
            }

            // Validate name format (before normalization)
            if (!isKebabCase(opts.name)) {
              if (opts.name !== opts.name.toLowerCase()) {
                throw new Error('Invalid --name. Use kebab-case (e.g. "component-rules")');
              }
              if (opts.name.includes("_")) {
                throw new Error('Invalid --name. Use kebab-case (e.g. "component-rules")');
              }
            }

            // Normalize name for file path calculation
            const normalizedName = normalizeName(opts.name);

            // Check if file exists first for logging
            const config = await loadConfig({ cwd: process.cwd() });
            const baseCursorDir = opts.cursorDir ?? config.cursorDir ?? ".nextforge/cursor";
            const baseDir = path.resolve(process.cwd(), baseCursorDir);
            const ext = format === "mdx" ? ".mdx" : ".json";
            const fileName = `${normalizedName}.rules${ext}`;
            const filePath = path.join(baseDir, "rules", fileName);

            const relPath = path.posix.normalize(path.relative(process.cwd(), filePath));
            let fileExists = false;
            try {
              await fs.access(filePath);
              fileExists = true;
            } catch {
              // File doesn't exist
            }

            if (fileExists && !opts.force) {
              console.log(`skip   ${relPath} (exists)`);
            } else {
              await createCursorRules({
                name: normalizedName,
                format,
                cwd: process.cwd(),
                force: !!opts.force,
                ...(opts.cursorDir && { cursorDir: opts.cursorDir }),
              });

              if (opts.force) {
                console.log(`force overwrite -> ${relPath}`);
              } else {
                console.log(`write  ${relPath}`);
              }
            }

            console.log(`\nCreated: ${relPath}`);

            // Extract name from file path for display
            const name = normalizedName;
            const indexPath = path.join(baseDir, "index.json");

            console.log(
              `Indexed: ${path.posix.normalize(path.relative(process.cwd(), indexPath))} (format=${format}, type=rules)`
            );
            console.log("\nNext in Cursor:");
            console.log('1) Open Settings → Rules → "+ New Rule"');
            console.log(`2) Paste the ${format.toUpperCase()} contents, name it "${name}"`);
            console.log("3) Save and pin to workspace");
          } else if (type === "phase") {
            // Validate required --phase flag
            if (!opts.phase) {
              throw new Error("--phase is required for type 'phase'");
            }

            const phaseNum = parseInt(opts.phase, 10);
            if (isNaN(phaseNum) || phaseNum < 1) {
              throw new Error("Invalid --phase. Provide a positive integer (e.g. --phase 3)");
            }

            // Use API function to create phase file
            // Check if file exists first for logging
            const config = await loadConfig({ cwd: process.cwd() });
            const baseCursorDir = opts.cursorDir ?? config.cursorDir ?? ".nextforge/cursor";
            const baseDir = path.resolve(process.cwd(), baseCursorDir);
            const ext = format === "mdx" ? ".mdx" : ".json";
            const fileName = `phase-${phaseNum}${ext}`;
            const filePath = path.join(baseDir, "phases", fileName);

            const relPath = path.posix.normalize(path.relative(process.cwd(), filePath));
            let fileExists = false;
            try {
              await fs.access(filePath);
              fileExists = true;
            } catch {
              // File doesn't exist
            }

            if (fileExists && !opts.force) {
              console.log(`skip   ${relPath} (exists)`);
            } else {
              await createCursorPhase({
                phase: phaseNum,
                format,
                cwd: process.cwd(),
                force: !!opts.force,
                ...(opts.cursorDir && { cursorDir: opts.cursorDir }),
              });

              if (opts.force) {
                console.log(`force overwrite -> ${relPath}`);
              } else {
                console.log(`write  ${relPath}`);
              }
            }

            console.log(`\nCreated: ${relPath}`);

            const indexPath = path.join(baseDir, "index.json");

            console.log(
              `Indexed: ${path.posix.normalize(path.relative(process.cwd(), indexPath))} (format=${format}, type=phases)`
            );
            console.log(`\nNext: Open the file and run the Phase ${phaseNum} checklist in Cursor.`);
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
