import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { configSchema, type NextForgeConfig } from "../utils/configSchema.js";

export type { NextForgeConfig };

const requireCjs = createRequire(import.meta.url);

/**
 * @deprecated Use NextForgeConfig instead. Kept for backward compatibility.
 */
export interface ForgeConfig {
  pagesDir?: string;
  useTailwind?: boolean;
  useChakra?: boolean;
  framework?: "react" | "next";
}

/**
 * Get default export from module.
 */
function getModuleDefault(mod: unknown): unknown {
  if (mod && typeof mod === "object" && "default" in (mod as Record<string, unknown>)) {
    return (mod as { default: unknown }).default;
  }
  return mod;
}

/**
 * Try to load a TypeScript config file using tsx or esbuild.
 */
async function loadTypeScriptConfig(file: string): Promise<unknown> {
  let usedTsx = false;
  let usedEsbuild = false;
  let tmpFile: string | undefined;

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
      usedTsx = true;
    } catch {
      try {
        // eslint-disable-next-line import/no-unresolved
        tsxAny = await import(tsxPath2);
        usedTsx = true;
      } catch {
        // eslint-disable-next-line import/no-unresolved
        tsxAny = await import(tsxPath3); // some versions export helpers on default
        usedTsx = true;
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
    usedEsbuild = true;

    const src = await fs.readFile(file, "utf8");
    const { code } = await transform(src, {
      loader: "ts",
      format: "esm",
      sourcemap: false,
      target: "es2022",
    });

    tmpFile = path.join(
      process.cwd(),
      ".nextforge",
      "tmp",
      `nf-${Date.now()}-${path.basename(file, ".ts")}.mjs`
    );
    await fs.mkdir(path.dirname(tmpFile), { recursive: true });
    await fs.writeFile(tmpFile, code, "utf8");

    try {
      const mod = await import(pathToFileURL(tmpFile).href);
      return getModuleDefault(mod);
    } finally {
      // Always clean up temp file after import
      try {
        await fs.unlink(tmpFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const filePath = path.relative(process.cwd(), file);

    // Check if this is a missing tsx/esbuild error
    if (message.includes("Cannot find package 'tsx'") || (!usedTsx && !usedEsbuild)) {
      throw new Error(
        `Failed to load ${filePath}. TypeScript config requires 'tsx' or 'esbuild'.\n\n` +
          `Install tsx as a dev dependency:\n` +
          `  npm i -D tsx\n\n` +
          `Alternatively, rename to nextforge.config.mjs or add "type":"module" to package.json.\n\n` +
          `Underlying error: ${message}`
      );
    }

    throw new Error(`Failed to load ${filePath}.\n\n` + `Underlying error: ${message}`);
  } finally {
    // Clean up temp file if it was created but not already cleaned up
    if (tmpFile) {
      try {
        await fs.unlink(tmpFile);
      } catch {
        // Already cleaned up or doesn't exist
      }
    }
  }
}

/**
 * Load config file from various formats.
 * Supports: .mjs, .cjs, .json, .ts, .js
 */
async function tryLoadConfig(file: string): Promise<unknown | undefined> {
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

  if (file.endsWith(".mjs") || file.endsWith(".js")) {
    const mod = await import(pathToFileURL(file).href);
    return getModuleDefault(mod);
  }

  if (file.endsWith(".ts")) {
    return await loadTypeScriptConfig(file);
  }

  return undefined;
}

/**
 * Load NextForge configuration from CWD.
 * Precedence: CLI flags override env vars, which override config file values.
 *
 * @param opts - Loading options
 * @param opts.cwd - Working directory (default: process.cwd())
 * @param opts.env - Environment variables (default: process.env)
 * @param opts.verbose - Log loaded config (default: false)
 * @returns Validated NextForgeConfig
 */
export async function loadConfig(
  opts?: string | { cwd?: string; env?: NodeJS.ProcessEnv; verbose?: boolean }
): Promise<NextForgeConfig> {
  // Support legacy signature: loadConfig(cwd: string)
  let cwd: string;
  let env: NodeJS.ProcessEnv;
  let verbose: boolean;

  if (typeof opts === "string") {
    cwd = opts;
    env = process.env;
    verbose = false;
  } else {
    cwd = opts?.cwd ?? process.cwd();
    env = opts?.env ?? process.env;
    verbose = opts?.verbose ?? false;
  }

  // Precedence: .ts → .mjs → .js → .cjs → .json
  const candidates = [
    "nextforge.config.ts",
    "nextforge.config.mjs",
    "nextforge.config.js",
    "nextforge.config.cjs",
    "nextforge.config.json",
  ].map((f) => path.join(cwd, f));

  let raw: unknown | undefined;
  for (const file of candidates) {
    const val = await tryLoadConfig(file);
    if (val != null) {
      raw = val;
      break;
    }
  }

  // Apply environment variable overrides
  const envOverrides: Partial<NextForgeConfig> = {};
  if (env.NEXTFORGE_USE_TAILWIND != null) {
    envOverrides.useTailwind = env.NEXTFORGE_USE_TAILWIND === "true";
  }
  if (env.NEXTFORGE_USE_CHAKRA != null) {
    envOverrides.useChakra = env.NEXTFORGE_USE_CHAKRA === "true";
  }
  if (env.NEXTFORGE_DEFAULT_LAYOUT) envOverrides.defaultLayout = env.NEXTFORGE_DEFAULT_LAYOUT;
  if (env.NEXTFORGE_PAGES_DIR) envOverrides.pagesDir = env.NEXTFORGE_PAGES_DIR;
  if (env.NEXTFORGE_CURSOR_DIR) envOverrides.cursorDir = env.NEXTFORGE_CURSOR_DIR;

  // Merge config file with env overrides
  const base = raw && typeof raw === "object" ? (raw as object) : {};
  const merged = { ...base, ...envOverrides };

  // Validate with zod schema
  const parsed = configSchema.safeParse(merged);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid nextforge config: ${issues}`);
  }
  const finalCfg = parsed.data;

  if (verbose || env.NEXTFORGE_DEBUG === "1") {
    // eslint-disable-next-line no-console
    console.log("[nextforge] Loaded config:", finalCfg);
  }

  return finalCfg;
}

/**
 * @deprecated Use loadConfig() which returns NextForgeConfig. This is kept for backward compatibility.
 * Load NextForge configuration from CWD and return legacy ForgeConfig interface.
 */
export async function loadConfigLegacy(cwd: string = process.cwd()): Promise<ForgeConfig> {
  const config = await loadConfig({ cwd });
  const result: ForgeConfig = {
    pagesDir: config.pagesDir,
    useTailwind: config.useTailwind,
    useChakra: config.useChakra,
  };
  // framework is not in NextForgeConfig, so it's omitted
  return result;
}
