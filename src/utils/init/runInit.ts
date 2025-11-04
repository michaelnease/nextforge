import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import { cjsTemplate, mjsTemplate, tsTemplate } from "./templates.js";

export interface InitFlags {
  force: boolean;
  yes: boolean;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function pkgManagerFromLock(cwd: string): Promise<"npm" | "pnpm" | "yarn"> {
  const has = async (f: string) => {
    try {
      await fs.access(path.join(cwd, f));
      return true;
    } catch {
      return false;
    }
  };
  if (await has("pnpm-lock.yaml")) return "pnpm";
  if (await has("yarn.lock")) return "yarn";
  return "npm";
}

async function readPackageJson(cwd: string) {
  const pkgPath = path.join(cwd, "package.json");
  try {
    const raw = await fs.readFile(pkgPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function hasDep(
  pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> },
  name: string
): boolean {
  return Boolean(pkg?.dependencies?.[name] || pkg?.devDependencies?.[name]);
}

function resolveLocal(dep: string, cwd: string): boolean {
  try {
    const require = createRequire(path.join(cwd, "package.json"));
    require.resolve(dep);
    return true;
  } catch {
    return false;
  }
}

export async function runInit(flags: InitFlags): Promise<void> {
  const cwd = process.cwd();
  const pkg = await readPackageJson(cwd);

  const useTS = hasDep(pkg, "typescript");
  const isESM = pkg?.type === "module";

  const ext = useTS ? "ts" : isESM ? "mjs" : "js";
  const target = `nextforge.config.${ext}`;

  if (!flags.force) {
    const existing = [
      "nextforge.config.ts",
      "nextforge.config.mjs",
      "nextforge.config.js",
      "nextforge.config.json",
      "nextforge.config.cjs",
    ];
    for (const f of existing) {
      if (await fileExists(path.join(cwd, f))) {
        console.log(`A config already exists at ${f}. Re-run with --force to overwrite.`);
        return;
      }
    }
  }

  if (ext === "ts") {
    const hasTsx = resolveLocal("tsx", cwd);
    if (!hasTsx) {
      const pm = await pkgManagerFromLock(cwd);
      const cmd =
        pm === "pnpm" ? "pnpm add -D tsx" : pm === "yarn" ? "yarn add -D tsx" : "npm i -D tsx";
      if (flags.yes) {
        console.log(`Installing tsx using ${pm}...`);
        try {
          execSync(cmd, { stdio: "inherit", cwd });
        } catch (err) {
          // Installation failed - this is okay in test environments
          console.log(`Failed to install tsx automatically. Please install manually: ${cmd}`);
        }
      } else {
        console.log(`TypeScript detected. tsx is required to load nextforge.config.ts`);
        console.log(`Run: ${cmd}`);
      }
    }
  }

  const content = ext === "ts" ? tsTemplate : isESM ? mjsTemplate : cjsTemplate;
  await fs.writeFile(path.join(cwd, target), content, "utf8");

  console.log(`Created ${target}`);
  if (ext === "ts" && !resolveLocal("tsx", cwd) && !flags.yes) {
    console.log(`If you did not auto-install tsx, install it now to avoid loader errors.`);
  }
  console.log(`Run: npx nextforge doctor`);
}
