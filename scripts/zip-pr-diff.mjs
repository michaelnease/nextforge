#!/usr/bin/env node
import { execSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import process from "node:process";
import archiver from "archiver";
import pc from "picocolors";

function run(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
}

function arg(name, fallback) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function safeRel(p) {
  return p.replaceAll("\\", "/");
}

function filterOut(file) {
  const patterns = [
    "^node_modules/",
    "^dist/",
    "^build/",
    "^coverage/",
    "^.next/",
    "^.nx/",
    "^.turbo/",
    "^out/",
    "^tmp/",
    "^temp/",
    "^scripts/temp/",
  ];
  const hidden = [
    "^\\.",
    "/\\.",
  ];
  const exts = [
    "\\.map$",
    "\\.log$",
    "\\.lock$",
  ];
  const all = new RegExp(`(${[...patterns, ...hidden, ...exts].join("|")})`);
  return all.test(file);
}

function main() {
  try {
    // Resolve base and head
    const baseArg = arg("base");
    const headArg = arg("head");
    const sinceTag = arg("since"); // optional alternative

    const head = headArg || "HEAD";
    let base;
    if (sinceTag) {
      base = sinceTag;
    } else if (baseArg) {
      base = baseArg;
    } else {
      // default base is the merge-base with origin/main if present, else main, else the previous commit
      let mainRef = "origin/main";
      try { run("git rev-parse --verify origin/main"); } catch { mainRef = "main"; }
      try {
        base = run(`git merge-base ${mainRef} ${head}`);
      } catch {
        base = run(`git rev-parse ${head}^`);
      }
    }

    // Get diff file list
    const diffCmd = `git diff --name-status -M -C ${base} ${head}`;
    const raw = run(diffCmd).split("\n").filter(Boolean);

    if (raw.length === 0) {
      console.log(pc.yellow("No changes detected for the given range."));
      process.exit(0);
    }

    const changes = [];
    for (const line of raw) {
      // Formats:
      // M  path
      // A  path
      // D  path
      // R100 old -> new
      const parts = line.split("\t");
      const code = parts[0];
      if (code.startsWith("R")) {
        const newPath = safeRel(parts[2] || "");
        changes.push({ status: "R", path: newPath });
      } else {
        const p = safeRel(parts[1] || "");
        const status = code[0];
        changes.push({ status, path: p });
      }
    }

    const files = changes
      .filter((c) => c.status !== "D") // skip deleted
      .map((c) => c.path)
      .filter((p) => p && existsSync(p))
      .filter((p) => !filterOut(p));

    if (files.length === 0) {
      console.log(pc.yellow("No remaining files to zip after filters."));
      process.exit(0);
    }

    // Prepare output
    const branch = (() => {
      try { return run("git rev-parse --abbrev-ref HEAD"); } catch { return "detached"; }
    })();
    const shortHead = run(`git rev-parse --short ${head}`);
    const outDir = path.join("scripts", "temp");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    const zipName = `pr-diff-${branch}-${shortHead}-${nowStamp()}.zip`;
    const zipPath = path.join(outDir, zipName);

    const output = createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    let added = 0;
    const manifestLines = [];
    manifestLines.push(`# nextforge PR diff manifest`);
    manifestLines.push(`base: ${base}`);
    manifestLines.push(`head: ${head}`);
    manifestLines.push(`branch: ${branch}`);
    manifestLines.push(`created_utc: ${new Date().toISOString()}`);
    manifestLines.push(`files:`);

    archive.on("warning", (err) => console.warn(pc.yellow(String(err))));
    archive.on("error", (err) => { throw err; });

    archive.pipe(output);

    for (const f of files) {
      const data = readFileSync(f);
      const hash = createHash("sha256").update(data).digest("hex");
      archive.append(data, { name: f, mode: 0o100644 });
      manifestLines.push(`  - path: ${f}`);
      manifestLines.push(`    bytes: ${data.length}`);
      manifestLines.push(`    sha256: ${hash}`);
      added++;
    }

    // Include git summary
    const log = run(`git log --oneline -n 20 ${base}..${head}`);
    manifestLines.push(``);
    manifestLines.push(`git_log_last_20:`); 
    for (const line of log.split("\n")) {
      manifestLines.push(`  - ${line}`);
    }

    // Write manifest
    const manifestText = manifestLines.join("\n");
    archive.append(manifestText, { name: "MANIFEST.txt" });

    archive.finalize();

    output.on("close", () => {
      console.log(pc.green(`Wrote ${zipPath}`));
      console.log(pc.cyan(`Files added: ${added}`));
      console.log(pc.dim(`Range: ${base}..${head}`));
    });
  } catch (err) {
    console.error(pc.red("Failed to create PR diff zip"));
    if (err instanceof Error) console.error(err.message);
    process.exit(1);
  }
}

main();
