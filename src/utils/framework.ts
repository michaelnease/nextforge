import type { NextforgeConfig } from "../types.js";

export type FrameworkChoice = "basic" | "tailwind" | "chakra" | "both";

export function validateFrameworkFlag(
  framework?: string
): asserts framework is FrameworkChoice | undefined {
  if (!framework) return;
  const allowed: FrameworkChoice[] = ["basic", "tailwind", "chakra", "both"];
  if (!allowed.includes(framework as FrameworkChoice)) {
    throw new Error("Invalid --framework. Use one of: chakra, tailwind, basic, both");
  }
}

/**
 * Precedence:
 *   1) --framework flag
 *   2) config: useTailwind/useChakra
 *   3) fallback "basic"
 */
export function resolveFramework(
  opts: { framework?: string },
  cfg?: Pick<NextforgeConfig, "useTailwind" | "useChakra">
): FrameworkChoice {
  validateFrameworkFlag(opts.framework);

  if (opts.framework) return opts.framework as FrameworkChoice;

  const tw = !!cfg?.useTailwind;
  const ch = !!cfg?.useChakra;

  if (tw && ch) return "both";
  if (tw) return "tailwind";
  if (ch) return "chakra";
  return "basic";
}

/** Convenience booleans for generators */
export function flagsFrom(choice: FrameworkChoice) {
  return {
    isBasic: choice === "basic",
    isTailwind: choice === "tailwind",
    isChakra: choice === "chakra",
    isBoth: choice === "both",
  };
}
