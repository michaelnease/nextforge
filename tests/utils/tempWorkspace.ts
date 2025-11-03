import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface CliResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

export interface TempWorkspace {
  dir: string;
  cleanup(): Promise<void>;
}

/**
 * Creates a temporary workspace directory and returns cleanup function.
 */
export async function makeTempWorkspace(name = "nextforge-e2e"): Promise<TempWorkspace> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `${name}-`));
  return {
    dir,
    async cleanup() {
      await fs.rm(dir, { recursive: true, force: true });
    },
  };
}

/**
 * Runs the CLI from bin/nextforge.js (which loads dist/index.js) with the given args.
 */
export async function runCli(cwd: string, ...args: string[]): Promise<CliResult> {
  const cliPath = path.resolve(process.cwd(), "bin", "nextforge.js");
  return new Promise((resolve) => {
    const proc = spawn("node", [cliPath, ...args], {
      cwd,
      env: { ...process.env, NODE_ENV: "test" },
      stdio: "pipe",
    });

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      resolve({ stdout, stderr, code });
    });
  });
}

/**
 * Check if a file or directory exists.
 */
export async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads a file as UTF-8 string.
 */
export async function readText(p: string): Promise<string> {
  return fs.readFile(p, "utf8");
}

/**
 * Writes JSON to a file.
 */
export async function writeJson(p: string, obj: unknown): Promise<void> {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

/**
 * Writes a text file.
 */
export async function writeFile(p: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, content, "utf8");
}

/**
 * Recursively read directory tree structure.
 * Returns empty array if directory doesn't exist.
 */
export async function readTree(root: string, rel = "."): Promise<string[]> {
  const out: string[] = [];
  const targetPath = path.resolve(root, rel);

  // Check if directory exists
  try {
    await fs.access(targetPath);
  } catch {
    return []; // Return empty array if directory doesn't exist
  }

  async function walk(cur: string, base = "") {
    try {
      const items = await fs.readdir(cur, { withFileTypes: true });
      for (const it of items) {
        const p = path.join(cur, it.name);
        const relp = path.join(base, it.name);
        if (it.isDirectory()) {
          out.push(relp + "/");
          await walk(p, relp);
        } else {
          out.push(relp);
        }
      }
    } catch {
      // Skip directories that can't be read
    }
  }
  await walk(targetPath);
  out.sort();
  return out;
}
