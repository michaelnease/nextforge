import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export async function makeTempWorkspace(name = "nextforge-e2e") {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `${name}-`));
  const cwd0 = process.cwd();
  process.chdir(dir);
  return {
    dir,
    restore() {
      process.chdir(cwd0);
    },
  };
}

export async function readTree(root: string, rel = "."): Promise<string[]> {
  const out: string[] = [];
  async function walk(cur: string, base = "") {
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
  }
  await walk(path.resolve(root, rel));
  out.sort();
  return out;
}

export async function readText(file: string) {
  return fs.readFile(file, "utf8");
}
