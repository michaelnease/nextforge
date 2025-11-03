import { promises as fs } from "node:fs";
import path from "node:path";

export type ResolveAppRootOpts = {
  /** CLI --app value (relative or absolute) */
  appFlag?: string;
  /** nextforge.config.* pagesDir (relative or absolute) */
  configPagesDir?: string;
  /** create the directory if missing (used by add:group) */
  createIfMissing?: boolean;
  /** override for testing */
  cwd?: string;
};

export async function resolveAppRoot(opts: ResolveAppRootOpts): Promise<string> {
  const { appFlag, configPagesDir, createIfMissing = false, cwd = process.cwd() } = opts;

  // precedence: --app > config.pagesDir > "app"
  const chosen = appFlag ?? configPagesDir ?? "app";

  // Normalize relative -> absolute, no implicit "/app" suffix
  const root = path.isAbsolute(chosen) ? chosen : path.join(cwd, chosen);

  try {
    await fs.access(root);
  } catch {
    if (createIfMissing) {
      await fs.mkdir(root, { recursive: true });
    } else {
      throw new Error("App directory not found");
    }
  }

  return root;
}
