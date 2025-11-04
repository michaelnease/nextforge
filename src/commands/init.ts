import { Command } from "commander";

import { runInit } from "../utils/init/runInit.js";

export const initCommand = new Command("init")
  .description("Initialize NextForge configuration")
  .option("--force", "Overwrite existing config file if present")
  .option("--yes", "Skip prompts and use detected defaults")
  .action(async (opts) => {
    try {
      await runInit({ force: !!opts.force, yes: !!opts.yes });
    } catch (err) {
      console.error("Init failed:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });
