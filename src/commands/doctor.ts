import { Command } from "commander";

import { runDoctor } from "../utils/doctor/runDoctor.js";

export const doctorCommand = new Command("doctor")
  .description("Run health checks for your NextForge setup")
  .option("--app <path>", "Path to Next.js app directory")
  .option("--json", "Output JSON instead of text")
  .option("--fix", "Try safe autofixes")
  .option("--ci", "CI-friendly mode (no colors, no prompts)")
  .option("--deep", "Run deep checks like tsc validation")
  .option("--verbose", "Verbose logging")
  .action(async (opts) => {
    try {
      const exitCode = await runDoctor(opts);
      process.exit(exitCode);
    } catch (err) {
      console.error("Doctor crashed:", err);
      process.exit(3);
    }
  });
