import path from "node:path";

import { ensureDir, exists, readText, writeText } from "./fsx.js";

/**
 * Component manifest structure
 */
export interface ComponentManifest {
  components: Record<string, string[]>;
  updatedAt: string;
}

/**
 * Page manifest structure
 */
export interface PageManifest {
  routes: string[];
  updatedAt: string;
}

/**
 * Update component manifest at .nextforge/manifest.json
 * Adds component to the specified group, maintains unique sorted list
 */
export async function updateComponentManifest(
  cwd: string,
  group: string,
  componentName: string
): Promise<void> {
  const manifestDir = path.join(cwd, ".nextforge");
  const manifestPath = path.join(manifestDir, "manifest.json");

  await ensureDir(manifestDir);

  let manifest: ComponentManifest = {
    components: {},
    updatedAt: new Date().toISOString(),
  };

  // Load existing manifest if it exists
  if (await exists(manifestPath)) {
    try {
      const content = await readText(manifestPath);
      const parsed = JSON.parse(content);
      manifest = {
        components: parsed.components || {},
        updatedAt: new Date().toISOString(),
      };
    } catch {
      // If parsing fails, start fresh
    }
  }

  // Initialize group array if it doesn't exist
  if (!manifest.components[group]) {
    manifest.components[group] = [];
  }

  // Add component if not already present
  if (!manifest.components[group].includes(componentName)) {
    manifest.components[group].push(componentName);
  }

  // Sort components case-insensitively
  manifest.components[group].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  // Write back
  await writeText(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
}

/**
 * Update page manifest at app/manifest.json
 * Adds route to the list, maintains unique sorted list
 */
export async function updatePageManifest(appDir: string, route: string): Promise<void> {
  const manifestPath = path.join(appDir, "manifest.json");

  let manifest: PageManifest = {
    routes: [],
    updatedAt: new Date().toISOString(),
  };

  // Load existing manifest if it exists
  if (await exists(manifestPath)) {
    try {
      const content = await readText(manifestPath);
      const parsed = JSON.parse(content);
      manifest = {
        routes: parsed.routes || [],
        updatedAt: new Date().toISOString(),
      };
    } catch {
      // If parsing fails, start fresh
    }
  }

  // Add route if not already present
  if (!manifest.routes.includes(route)) {
    manifest.routes.push(route);
  }

  // Sort routes case-insensitively
  manifest.routes.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  // Write back
  await writeText(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
}
