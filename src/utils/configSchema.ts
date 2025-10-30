import { z } from "zod";

export const configSchema = z.object({
  useTailwind: z.boolean().default(true),
  useChakra: z.boolean().default(false),
  defaultLayout: z.string().default("main"),
  pagesDir: z.string().default("app"),
});

export type NextForgeConfig = z.infer<typeof configSchema>;

export function defineConfig(c: z.input<typeof configSchema>) {
  return c;
}
