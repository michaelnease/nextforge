import path from "node:path";

import type { Command } from "commander";

import { loadConfig } from "../../config/loadConfig.js";
import {
  makeChakraStylesSource,
  makeComponentSource,
  makeTestSource,
} from "../../generators/components.js";
import { flagsFrom, resolveFramework } from "../../utils/framework.js";
import { ensureDir } from "../../utils/fsx.js";
import { updateComponentManifest } from "../../utils/manifest.js";
import { type Group } from "../../utils/paths.js";
import { resolveAppRoot } from "../../utils/resolveAppRoot.js";

/**
 * Generate CSS module template
 */
function cssModuleTemplate(): string {
  return `.container {
  /* Add your styles here */
}
`;
}

/**
 * Generate Storybook story template
 */
function storyTemplate(name: string, group: string): string {
  return `import type { Meta, StoryObj } from "@storybook/react";
import ${name} from "./${name}";

const meta = {
  title: "components/${group}/${name}",
  component: ${name},
} satisfies Meta<typeof ${name}>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};
`;
}

export function registerAddComponent(program: Command) {
  program
    .command("add:component")
    .description("Create a component in <app>/components/<group>/<Name>")
    .argument("<target>", "Component name, e.g. Button or ui/Button")
    .option("--group <group>", "Component group: ui | layout | section | feature")
    .option("--app <dir>", "App directory")
    .option("--framework <value>", "Framework: react | next")
    .option("--force", "Overwrite existing files", false)
    .option("--with-tests", "Create test file", false)
    .option("--with-style", "Create style file", false)
    .option("--with-story", "Create Storybook story file", false)
    .option("--client", "Add 'use client' directive", false)
    .action(
      async (
        target: string,
        opts: {
          group?: string;
          app?: string;
          framework?: string;
          force?: boolean;
          withTests?: boolean;
          withStyle?: boolean;
          withStory?: boolean;
          client?: boolean;
        }
      ) => {
        // Load config first
        const config = await loadConfig(process.cwd()).catch(
          () => ({}) as { useTailwind?: boolean; useChakra?: boolean; pagesDir?: string }
        );

        // Resolve app root with precedence: --app > config.pagesDir > "app"
        // Throws "App directory not found" if missing
        const appRoot = await resolveAppRoot({
          ...(opts.app && { appFlag: opts.app }),
          ...(config.pagesDir && { configPagesDir: config.pagesDir }),
          createIfMissing: false, // components must error if the app dir is missing
        });

        // Parse target: support "ui/Button" or "marketing/Hero" syntax
        // Extract group and nested path from target
        let group: Group;
        let componentName: string;
        let nestedPath = "";

        const parts = target.split("/");

        // Check for path traversal
        if (target.includes("..")) {
          throw new Error("Path traversal detected. Component paths cannot contain '..'.");
        }

        // Helper to capitalize first letter (PascalCase)
        const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

        if (parts.length === 1) {
          // Simple case: "Button" with --group flag
          componentName = parts[0]!;
          group = (opts.group || "ui") as Group;
        } else if (parts.length === 2) {
          // Two parts: could be "ui/Button" (group/name) or treated as nested
          const [first, second] = parts;
          const VALID_GROUPS = new Set(["ui", "layout", "section", "feature"]);

          if (VALID_GROUPS.has(first!) && !opts.group) {
            // First part is a valid group: "ui/Button"
            group = first! as Group;
            componentName = second!;
          } else {
            // First part is a subdirectory: "marketing/Hero" -> "Marketing/Hero"
            group = (opts.group || "ui") as Group;
            nestedPath = capitalize(first!);
            componentName = second!;
          }
        } else {
          // More than 2 parts: nested subdirectories - capitalize each segment
          componentName = parts[parts.length - 1]!;
          group = (opts.group || "ui") as Group;
          nestedPath = parts.slice(0, -1).map(capitalize).join("/");
        }

        // Validations - throw errors for test harness
        const VALID_GROUPS = new Set(["ui", "layout", "section", "feature"]);
        if (!VALID_GROUPS.has(group)) {
          throw new Error("Invalid --group. Use ui | layout | feature | section.");
        }

        if (!/^[A-Z][A-Za-z0-9]*$/.test(componentName)) {
          throw new Error("Invalid component name. Use PascalCase and do not start with a number.");
        }

        // Framework resolution with validation
        const framework = resolveFramework(
          opts.framework ? { framework: opts.framework } : {},
          config
        );
        const fw = flagsFrom(framework);

        // Paths - include nested path if present
        const base = nestedPath
          ? path.join(appRoot, "components", group, nestedPath, componentName)
          : path.join(appRoot, "components", group, componentName);
        await ensureDir(base);

        // Component file
        const componentCode = makeComponentSource({
          name: componentName,
          group,
          fw,
          addClient: !!opts.client,
        });
        await writeIfAbsentOrForce(
          path.join(base, `${componentName}.tsx`),
          componentCode,
          !!opts.force
        );

        // Style files (only if --with-style is set)
        if (opts.withStyle) {
          const writeCssModule = (fw.isBasic || fw.isChakra) && !fw.isTailwind && !fw.isBoth;
          const writeChakraStyles = fw.isChakra || fw.isBoth;

          if (writeCssModule) {
            await writeIfAbsentOrForce(
              path.join(base, `${componentName}.module.css`),
              cssModuleTemplate(),
              !!opts.force
            );
          }

          if (writeChakraStyles) {
            await writeIfAbsentOrForce(
              path.join(base, `${componentName}.styles.ts`),
              makeChakraStylesSource(componentName),
              !!opts.force
            );
          }
        }

        // Folder barrel
        await writeIfAbsentOrForce(
          path.join(base, `index.ts`),
          `export { default } from "./${componentName}";\n`,
          !!opts.force
        );

        // Per-kind barrel - include nested path if present
        const barrelComponentPath = nestedPath ? `${nestedPath}/${componentName}` : componentName;
        await updateKindBarrel(
          path.join(appRoot, "components", group, "index.ts"),
          barrelComponentPath,
          componentName
        );

        // Manifest
        await updateComponentManifest(process.cwd(), group, componentName);

        // Story
        if (opts.withStory) {
          await writeIfAbsentOrForce(
            path.join(base, `${componentName}.stories.tsx`),
            storyTemplate(componentName, group),
            !!opts.force
          );
        }

        // Test file
        if (opts.withTests) {
          await writeIfAbsentOrForce(
            path.join(base, `${componentName}.test.tsx`),
            makeTestSource(componentName),
            !!opts.force
          );
        }
      }
    );
}

/**
 * Write file if absent or with force
 */
async function writeIfAbsentOrForce(file: string, content: string, force: boolean): Promise<void> {
  const fs = await import("node:fs/promises");
  if (!force) {
    try {
      await fs.access(file);
      return;
    } catch {
      // File doesn't exist, proceed to write
    }
  }
  await fs.writeFile(file, content, "utf8");
}

/**
 * Update per-kind barrel file
 * @param barrelPath - Path to the barrel file
 * @param componentPath - Full path to component (e.g., "Marketing/Hero" or "Button")
 * @param exportName - Name to export as (e.g., "Hero" or "Button")
 */
async function updateKindBarrel(
  barrelPath: string,
  componentPath: string,
  exportName: string
): Promise<void> {
  const fs = await import("node:fs/promises");
  await fs.mkdir(path.dirname(barrelPath), { recursive: true });

  let current = "";
  try {
    current = await fs.readFile(barrelPath, "utf8");
  } catch {
    // File doesn't exist yet
  }

  const needle = `export { default as ${exportName} } from "${componentPath}/${exportName}";`;
  if (!current.includes(needle)) {
    // Split into lines, add new export, sort, and rejoin
    const lines = current.split("\n").filter((line) => line.trim());
    lines.push(needle);
    lines.sort();
    current = lines.join("\n") + "\n";
  }

  await fs.writeFile(barrelPath, current, "utf8");
}
