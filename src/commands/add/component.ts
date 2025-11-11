import path from "node:path";

import type { Command } from "commander";

import { loadConfig } from "../../config/loadConfig.js";
import {
  makeChakraStylesSource,
  makeComponentSource,
  makeTestSource,
} from "../../generators/components.js";
import { cssModuleTemplate, storyTemplate } from "../../templates/index.js";
import { upsertExport } from "../../utils/barrel.js";
import { flagsFrom, resolveFramework } from "../../utils/framework.js";
import { ensureDir, safeWrite } from "../../utils/fsx.js";
import { updateComponentManifest } from "../../utils/manifest.js";
import { type Group } from "../../utils/paths.js";
import { resolveAppRoot } from "../../utils/resolveAppRoot.js";
import { runCommand } from "../../utils/runCommand.js";

export function registerAddComponent(program: Command) {
  program
    .command("add:component")
    .description("Create a component in components/<type>/<Name> (sibling to app directory)")
    .argument("<target>", "Component name, e.g. Button or ui/Button")
    .option("--type <kind>", "Component type: ui | layout | section | feature")
    .option(
      "--group <group>",
      "Component group: ui | layout | section | feature (alias for --type)"
    )
    .option("--app <dir>", "App directory")
    .option("--framework <value>", "Framework: react | next")
    .option("--force", "Overwrite existing files", false)
    .option("--with-tests", "Create test file", false)
    .option("--with-style", "Create style file", false)
    .option("--with-story", "Create Storybook story file", false)
    .option("--client", "Add 'use client' directive", false)
    .option("--verbose", "Verbose logging", false)
    .option("--profile", "Enable detailed performance profiling")
    .option("--trace", "Output trace tree showing spans and durations")
    .option("--metrics <format>", "Output performance metrics (format: json)")
    .option("--log-data <mode>", "Log data introspection mode: off, summary, full")
    .option("--redact <keys>", "Additional comma-separated keys to redact")
    .option("--no-redact", "Disable redaction (local development only)")
    .action(
      async (
        target: string,
        opts: {
          type?: string;
          group?: string;
          app?: string;
          framework?: string;
          force?: boolean;
          withTests?: boolean;
          withStyle?: boolean;
          withStory?: boolean;
          client?: boolean;
          verbose?: boolean;
          profile?: boolean;
          trace?: boolean;
          metrics?: string;
          logData?: string;
          redact?: string;
          noRedact?: boolean;
        }
      ) => {
        await runCommand(
          "add:component",
          async ({ logger, profiler }) => {
            // Load config first - let errors propagate for invalid schemas
            let config;
            try {
              config = await loadConfig({ cwd: process.cwd() });
            } catch (err) {
              // Re-throw config validation errors
              if (err instanceof Error && err.message.includes("Invalid nextforge config")) {
                console.error(err.message);
                process.exitCode = 1;
                throw err;
              }
              // For other errors (missing config), use defaults
              config = {
                useTailwind: true,
                useChakra: false,
                pagesDir: "app",
              };
            }

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
              // Simple case: "Button" with --type or --group flag
              componentName = parts[0]!;
              // --type takes precedence over --group for backward compatibility
              group = (opts.type || opts.group || "ui") as Group;
            } else if (parts.length === 2) {
              // Two parts: could be "ui/Button" (group/name) or treated as nested
              const [first, second] = parts;
              const VALID_GROUPS = new Set(["ui", "layout", "section", "feature"]);

              if (VALID_GROUPS.has(first!) && !opts.type && !opts.group) {
                // First part is a valid group: "ui/Button"
                group = first! as Group;
                componentName = second!;
              } else {
                // First part is a subdirectory: "marketing/Hero" -> "Marketing/Hero"
                group = (opts.type || opts.group || "ui") as Group;
                nestedPath = capitalize(first!);
                componentName = second!;
              }
            } else {
              // More than 2 parts: nested subdirectories - capitalize each segment
              componentName = parts[parts.length - 1]!;
              group = (opts.type || opts.group || "ui") as Group;
              nestedPath = parts.slice(0, -1).map(capitalize).join("/");
            }

            // Validations - throw errors for test harness
            const VALID_GROUPS = new Set(["ui", "layout", "section", "feature"]);
            if (!VALID_GROUPS.has(group)) {
              throw new Error("Invalid --type/--group. Use ui | layout | section | feature.");
            }

            if (!/^[A-Z][A-Za-z0-9]*$/.test(componentName)) {
              throw new Error(
                "Invalid component name. Use PascalCase and do not start with a number."
              );
            }

            // Framework resolution with validation
            const framework = resolveFramework(
              opts.framework ? { framework: opts.framework } : {},
              config ? { useTailwind: config.useTailwind, useChakra: config.useChakra } : undefined
            );
            const fw = flagsFrom(framework);

            // Compute components directory as sibling to app directory
            // Examples:
            // - appRoot: "app" → componentsRoot: "components"
            // - appRoot: "src/app" → componentsRoot: "src/components"
            // - appRoot: "apps/web/app" → componentsRoot: "apps/web/components"
            const appParent = path.dirname(appRoot);
            const componentsRoot =
              appParent === "." ? "components" : path.join(appParent, "components");

            // Paths - include nested path if present
            const base = nestedPath
              ? path.join(componentsRoot, group, nestedPath, componentName)
              : path.join(componentsRoot, group, componentName);
            await ensureDir(base);

            // Component file
            const componentCode = makeComponentSource({
              name: componentName,
              group,
              fw,
              addClient: !!opts.client,
            });
            await safeWrite(
              path.join(base, `${componentName}.tsx`),
              componentCode,
              opts.force ? { force: true, profiler, logger } : { profiler, logger }
            );

            // Style files (only if --with-style is set)
            if (opts.withStyle) {
              const writeCssModule = (fw.isBasic || fw.isChakra) && !fw.isTailwind && !fw.isBoth;
              const writeChakraStyles = fw.isChakra || fw.isBoth;

              if (writeCssModule) {
                await safeWrite(
                  path.join(base, `${componentName}.module.css`),
                  cssModuleTemplate(),
                  opts.force ? { force: true, profiler, logger } : { profiler, logger }
                );
              }

              if (writeChakraStyles) {
                await safeWrite(
                  path.join(base, `${componentName}.styles.ts`),
                  makeChakraStylesSource(componentName),
                  opts.force ? { force: true, profiler, logger } : { profiler, logger }
                );
              }
            }

            // Folder barrel
            await safeWrite(
              path.join(base, `index.ts`),
              `export { default } from "./${componentName}";\n`,
              opts.force ? { force: true, profiler, logger } : { profiler, logger }
            );

            // Per-kind barrel - include nested path if present
            const barrelComponentPath = nestedPath
              ? `${nestedPath}/${componentName}`
              : componentName;
            // Always use POSIX separators for barrel exports
            const barrelRelativePath = `./${barrelComponentPath.replace(/\\/g, "/")}`;
            await upsertExport(
              path.join(componentsRoot, group, "index.ts"),
              `export { default as ${componentName} } from "${barrelRelativePath}"`
            );

            // Manifest
            await updateComponentManifest(process.cwd(), group, componentName);

            // Story
            if (opts.withStory) {
              await safeWrite(
                path.join(base, `${componentName}.stories.tsx`),
                storyTemplate(componentName, group),
                opts.force ? { force: true, profiler, logger } : { profiler, logger }
              );
            }

            // Test file
            if (opts.withTests) {
              await safeWrite(
                path.join(base, `${componentName}.test.tsx`),
                makeTestSource(componentName),
                opts.force ? { force: true, profiler, logger } : { profiler, logger }
              );
            }

            logger.info({ component: componentName, group }, "Component created successfully");
          },
          {
            verbose: opts.verbose,
            profile: opts.profile,
            trace: opts.trace,
            metricsJson: opts.metrics === "json",
            logData: opts.logData,
            redact: opts.redact,
            noRedact: opts.noRedact === true,
          }
        );
      }
    );
}
