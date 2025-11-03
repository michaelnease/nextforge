#!/usr/bin/env node
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mod = await import(join(__dirname, "../dist/index.js"));
const main = typeof mod.main === "function" ? mod.main : null;
if (!main) {
  console.error("nextforge: dist/index.js did not export main()");
  process.exit(1);
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exitCode = 1;
});
