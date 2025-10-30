import { configSchema, type NextForgeConfig } from "./configSchema.js";

export function mergeConfig({
  fileConfig,
  env,
  flags,
}: {
  fileConfig?: Partial<NextForgeConfig>;
  env: NodeJS.ProcessEnv;
  flags?: Partial<NextForgeConfig>;
}): NextForgeConfig {
  const envOverrides: Partial<NextForgeConfig> = {};
  if (env.NEXTFORGE_USE_TAILWIND != null)
    envOverrides.useTailwind = env.NEXTFORGE_USE_TAILWIND === "true";
  if (env.NEXTFORGE_USE_CHAKRA != null)
    envOverrides.useChakra = env.NEXTFORGE_USE_CHAKRA === "true";
  if (env.NEXTFORGE_DEFAULT_LAYOUT) envOverrides.defaultLayout = env.NEXTFORGE_DEFAULT_LAYOUT;
  if (env.NEXTFORGE_PAGES_DIR) envOverrides.pagesDir = env.NEXTFORGE_PAGES_DIR;

  const parsed = configSchema.safeParse({
    ...fileConfig,
    ...envOverrides,
    ...flags,
  });

  return parsed.success ? parsed.data : configSchema.parse({});
}
