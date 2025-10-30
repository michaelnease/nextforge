import fs from "node:fs";
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
  if (!fs.existsSync(file)) return undefined;
  if (file.endsWith(".json")) {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  }
  if (file.endsWith(".js") || file.endsWith(".mjs")) {
    const mod: unknown = await import(pathToFileURL(file).href);
    return getModuleDefault(mod);
  }
  if (file.endsWith(".cjs")) {
    const mod: unknown = requireCjs(file);
    return getModuleDefault(mod);
  }
  if (file.endsWith(".ts")) {
    try {
      const mod: unknown = await import(pathToFileURL(file).href);
      return getModuleDefault(mod);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        [
          `Failed to load ${path.basename(file)}.`,
          `If you want a TypeScript config, run with a TS loader (e.g. "tsx nextforge ..."),`,
          `or rename to nextforge.config.mjs/js/json.`,
          `Underlying error: ${message}`,
        ].join(" ")
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
    raw = await tryLoadModule(file);
    if (raw != null) break;
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

  const merged = { ...(raw as object | undefined), ...envOverrides };
  const parsed = configSchema.safeParse(merged ?? {});
  const finalCfg = parsed.success ? parsed.data : configSchema.parse({});

  if (opts?.verbose || env.NEXTFORGE_DEBUG === "1") {
    // eslint-disable-next-line no-console
    console.log("Loaded NextForge config", finalCfg);
  }
  return finalCfg;
}
