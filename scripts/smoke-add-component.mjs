// Run: node scripts/smoke-add-component.mjs
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, opts, (err, stdout, stderr) => {
      if (err) return reject(Object.assign(err, { stdout, stderr }));
      resolve({ stdout, stderr });
    });
  });
}

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "nextforge-smoke-"));
const dist = path.resolve(process.cwd(), "dist", "index.js");
await fs.mkdir(path.join(tmp, "app"), { recursive: true });
await fs.writeFile(
  path.join(tmp, "nextforge.config.json"),
  JSON.stringify({ useTailwind: true, useChakra: false, pagesDir: "app" }, null, 2)
);

console.log("Temp workspace:", tmp);
const args = [dist, "add:component", "Button", "--group", "ui", "--app", "app", "--client"];
const { stdout, stderr } = await run(process.execPath, args, { cwd: tmp });
process.stdout.write(stdout);
process.stderr.write(stderr);
