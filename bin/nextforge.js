#!/usr/bin/env node
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mod;
try {
  mod = await import(join(__dirname, "../dist/index.js"));
} catch (err) {
  console.error("nextforge: Failed to load CLI module.");
  console.error(err?.stack || String(err));
  console.error(
    "\nIf this issue persists, check your installation or report it to the maintainers."
  );
  process.exit(1);
}

const main = typeof mod.main === "function" ? mod.main : null;
if (!main) {
  console.error("nextforge: dist/index.js did not export main()");
  console.error(
    "\nIf this issue persists, check your installation or report it to the maintainers."
  );
  process.exit(1);
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  // Respect exit code if already set (e.g., by runCommand)
  // Otherwise use exitCode from error, or default to 1
  if (process.exitCode === undefined || process.exitCode === 0) {
    process.exitCode = err?.exitCode || err?.code || 1;
  }
});
