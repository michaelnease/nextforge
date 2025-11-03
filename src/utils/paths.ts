import path from "node:path";

/**
 * Normalize app path: replace backslashes with forward slashes, remove trailing slash.
 */
export function normalizeAppPath(input: string): string {
  return input.replace(/\\/g, "/").replace(/\/$/, "");
}

/**
 * Resolve app directory path.
 * Normalizes Windows paths and resolves to absolute path.
 */
export function resolveAppDir(cwd: string, appArg?: string, configPagesDir?: string): string {
  const dir = appArg ?? configPagesDir ?? "app";
  const normalized = normalizeAppPath(dir);
  return path.resolve(cwd, normalized);
}

export type Group = "ui" | "layout" | "section" | "feature";

export interface ComponentDirs {
  groupDir: string;
  componentDir: string;
  barrelPath: string;
}

/**
 * Compute component directories for a given group and component name.
 */
export function componentDirs(
  appDir: string,
  group: Group,
  componentName: string,
  subdirs: string[] = []
): ComponentDirs {
  const groupDir = path.join(appDir, "components", group);
  const componentDir = path.join(groupDir, ...subdirs, componentName);
  const barrelPath = path.join(groupDir, "index.ts");
  return { groupDir, componentDir, barrelPath };
}
