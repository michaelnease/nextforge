import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { configSchema, type NextForgeConfig } from "./configSchema.js";

const requireCjs = createRequire(import.meta.url);

function getModuleDefault(mod: unknown): unknown {
  if (mod && typeof mod === "object" && "default" in (mod as Record<string, unknown>)) {
    return (mod as { default: unknown }).default;
  }
  return mod;
}

async function tryLoadModule(file: string): Promise<unknown | undefined> {
  try {
    await fs.access(file);
  } catch {
    return undefined;
  }

  if (file.endsWith(".json")) {
    const content = await fs.readFile(file, "utf8");
    return JSON.parse(content);
  }

  if (file.endsWith(".cjs")) {
    return getModuleDefault(requireCjs(file));
  }

  if (file.endsWith(".js") || file.endsWith(".mjs")) {
    const mod = await import(pathToFileURL(file).href);
    return getModuleDefault(mod);
  }

  if (file.endsWith(".ts")) {
    try {
      // Try several tsx programmatic API entrypoints
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let tsxAny: any;
      const tsxPath1 = "tsx/esm/api.js";
      const tsxPath2 = "tsx/esm/api";
      const tsxPath3 = "tsx";
      try {
        // eslint-disable-next-line import/no-unresolved
        tsxAny = await import(tsxPath1);
      } catch {
        try {
          // eslint-disable-next-line import/no-unresolved
          tsxAny = await import(tsxPath2);
        } catch {
          // eslint-disable-next-line import/no-unresolved
          tsxAny = await import(tsxPath3); // some versions export helpers on default
        }
      }

      const loadFile = tsxAny?.loadFile ?? tsxAny?.default?.loadFile ?? tsxAny?.api?.loadFile;

      if (typeof loadFile === "function") {
        const ns = await loadFile(pathToFileURL(file));
        return getModuleDefault(ns);
      }

      // Fallback: transpile with esbuild and import the result as ESM
      const esbuildPath = "esbuild";
      // eslint-disable-next-line import/no-unresolved
      const { transform } = await import(esbuildPath);
      const src = await fs.readFile(file, "utf8");
      const { code } = await transform(src, {
        loader: "ts",
        format: "esm",
        sourcemap: false,
        target: "es2022",
      });

      const tmp = path.join(
        process.cwd(),
        ".nextforge",
        "tmp",
        `nf-${Date.now()}-${path.basename(file, ".ts")}.mjs`
      );
      await fs.mkdir(path.dirname(tmp), { recursive: true });
      await fs.writeFile(tmp, code, "utf8");
      const mod = await import(pathToFileURL(tmp).href);
      return getModuleDefault(mod);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Failed to load ${path.basename(file)}. ` +
          `Install 'tsx' (dev dep) or rename to nextforge.config.mjs, ` +
          `or add "type":"module" to package.json. Underlying error: ${message}`
      );
    }
  }

  return undefined;
}

export async function loadConfig(opts?: {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  verbose?: boolean;
}): Promise<NextForgeConfig> {
  const cwd = opts?.cwd ?? process.cwd();
  const env = opts?.env ?? process.env;

  const candidates = [
    "nextforge.config.ts",
    "nextforge.config.mjs",
    "nextforge.config.js",
    "nextforge.config.cjs",
    "nextforge.config.json",
  ].map((f) => path.join(cwd, f));

  let raw: unknown | undefined;
  for (const file of candidates) {
    const val = await tryLoadModule(file);
    if (val != null) {
      raw = val;
      break;
    }
  }

  const envOverrides: Partial<NextForgeConfig> = {};
  if (env.NEXTFORGE_USE_TAILWIND != null) {
    envOverrides.useTailwind = env.NEXTFORGE_USE_TAILWIND === "true";
  }
  if (env.NEXTFORGE_USE_CHAKRA != null) {
    envOverrides.useChakra = env.NEXTFORGE_USE_CHAKRA === "true";
  }
  if (env.NEXTFORGE_DEFAULT_LAYOUT) envOverrides.defaultLayout = env.NEXTFORGE_DEFAULT_LAYOUT;
  if (env.NEXTFORGE_PAGES_DIR) envOverrides.pagesDir = env.NEXTFORGE_PAGES_DIR;

  const base = raw && typeof raw === "object" ? (raw as object) : {};
  const merged = { ...base, ...envOverrides };

  const parsed = configSchema.safeParse(merged);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid nextforge config: ${issues}`);
  }
  const finalCfg = parsed.data;

  if (opts?.verbose || env.NEXTFORGE_DEBUG === "1") {
    // eslint-disable-next-line no-console
    console.log("[nextforge] Loaded config:", finalCfg);
  }
  return finalCfg;
}
