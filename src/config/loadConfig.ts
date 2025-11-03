import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const requireCjs = createRequire(import.meta.url);

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
  // Try tsx first
  try {
    // Try different tsx entry points
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let tsxAny: any;
    const tsxPaths = ["tsx/esm/api.js", "tsx/esm/api", "tsx"];

    for (const tsxPath of tsxPaths) {
      try {
        tsxAny = await import(tsxPath);
        break;
      } catch {
        // Continue to next path
      }
    }

    if (tsxAny) {
      const loadFile = tsxAny?.loadFile ?? tsxAny?.default?.loadFile ?? tsxAny?.api?.loadFile;

      if (typeof loadFile === "function") {
        const ns = await loadFile(pathToFileURL(file));
        return getModuleDefault(ns);
      }
    }

    // Fallback to esbuild
    try {
      const esbuildPath = "esbuild";
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
    } catch {
      // esbuild also failed
    }

    throw new Error("TypeScript configs require 'tsx'");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("tsx") || message.includes("esbuild") || message.includes("TypeScript")) {
      throw new Error("TypeScript configs require 'tsx'");
    }
    throw err;
  }
}

/**
 * Load config file from various formats.
 * Supports: .mjs, .cjs, .json, .ts
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
 * Precedence: CLI flags override config file values.
 */
export async function loadConfig(cwd: string = process.cwd()): Promise<ForgeConfig> {
  const candidates = [
    "nextforge.config.mjs",
    "nextforge.config.cjs",
    "nextforge.config.json",
    "nextforge.config.ts",
  ].map((f) => path.join(cwd, f));

  for (const file of candidates) {
    const config = await tryLoadConfig(file);
    if (config != null) {
      // Validate and return partial config
      const result: ForgeConfig = {};
      if (config && typeof config === "object") {
        const obj = config as Record<string, unknown>;
        const errors: string[] = [];

        if ("pagesDir" in obj) {
          if (typeof obj.pagesDir === "string") {
            result.pagesDir = obj.pagesDir;
          } else {
            errors.push("pagesDir: Expected string");
          }
        }
        if ("useTailwind" in obj) {
          if (typeof obj.useTailwind === "boolean") {
            result.useTailwind = obj.useTailwind;
          } else {
            errors.push("useTailwind: Expected boolean");
          }
        }
        if ("useChakra" in obj) {
          if (typeof obj.useChakra === "boolean") {
            result.useChakra = obj.useChakra;
          } else {
            errors.push("useChakra: Expected boolean");
          }
        }
        if ("framework" in obj) {
          if (typeof obj.framework === "string") {
            result.framework = obj.framework as "react" | "next";
          } else {
            errors.push("framework: Expected string");
          }
        }

        if (errors.length > 0) {
          const message = `Invalid nextforge config: ${errors.join("; ")}`;
          console.error(message);
          process.exitCode = 1;
          throw new Error(message);
        }
      }
      return result;
    }
  }

  return {};
}
