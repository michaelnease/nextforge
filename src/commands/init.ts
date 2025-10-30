import fs from "node:fs/promises";
import path from "node:path";

import type { Command } from "commander";

async function writeIfAbsent(filePath: string, contents: string, force = false) {
  if (!force) {
    try {
      await fs.access(filePath);
      return false; // exists, do not overwrite
    } catch {
      // not found, fall through
    }
  }
  await fs.writeFile(filePath, contents, "utf8");
  return true;
}

function configTemplate() {
  return `export default {
  useTailwind: true,
  useChakra: false,
  defaultLayout: "main",
  pagesDir: "app",
};
`;
}

export function registerInit(program: Command) {
  program
    .command("init")
    .description("Create a nextforge.config.ts in the current project")
    .option("--force", "Overwrite existing config file", false)
    .action(async (opts) => {
      try {
        const target = path.resolve(process.cwd(), "nextforge.config.ts");
        const created = await writeIfAbsent(target, configTemplate(), opts.force);
        const rel = path.relative(process.cwd(), target) || target;
        if (created) {
          console.log(`Created ${rel}`);
        } else {
          console.log(`${rel} already exists. Use --force to overwrite.`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`init failed: ${msg}`);
        process.exitCode = 1;
      }
    });
}
