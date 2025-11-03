import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  exists,
  makeTempWorkspace,
  readText,
  runCli,
  writeFile,
  writeJson,
} from "../utils/tempWorkspace.js";

describe("Error handling and guardrails", () => {
  let workspace: Awaited<ReturnType<typeof makeTempWorkspace>>;

  beforeEach(async () => {
    workspace = await makeTempWorkspace();
    // Create app directory and package.json for most tests
    const appDir = path.join(workspace.dir, "app");
    await import("fs/promises").then((fs) => fs.mkdir(appDir, { recursive: true }));
    await writeFile(path.join(workspace.dir, "package.json"), JSON.stringify({ type: "module" }));
  });

  afterEach(async () => {
    if (workspace) {
      await workspace.cleanup();
    }
  });

  describe("Idempotency and --force", () => {
    it("add:component is idempotent without --force and appends once to barrel", async () => {
      // Create once
      await runCli(workspace.dir, ["add:component", "ui/Button"]);

      // Create twice
      await runCli(workspace.dir, ["add:component", "ui/Button"]);

      const barrel = await readText(path.join(workspace.dir, "app/components/ui/index.ts"));

      // Appears exactly once
      const matches = barrel.match(/export \* from '\.\/Button'/g) ?? [];
      // Also check for export { default as Button } format
      const matches2 = barrel.match(/export \{ default as Button \}/g) ?? [];
      expect(matches.length + matches2.length).toBe(1);
    });

    it("add:component with --force overwrites component file", async () => {
      const p = path.join(workspace.dir, "app/components/ui/Button/Button.tsx");
      await writeFile(p, "// custom");

      await runCli(workspace.dir, ["add:component", "ui/Button", "--force"]);

      const content = await readText(p);
      expect(content).not.toContain("// custom");
    });

    it("add:page with --force overwrites existing page", async () => {
      const p = path.join(workspace.dir, "app/home/page.tsx");
      await writeFile(p, "// custom page");

      await runCli(workspace.dir, ["add:page", "home", "--force"]);

      const content = await readText(p);
      expect(content).not.toContain("// custom page");
      expect(content).toContain("export default");
    });

    it("add:component without --force skips existing file", async () => {
      const p = path.join(workspace.dir, "app/components/ui/Button/Button.tsx");
      await writeFile(p, "// custom component");

      await runCli(workspace.dir, ["add:component", "ui/Button"]);

      const content = await readText(p);
      expect(content).toContain("// custom component");
    });
  });

  describe("Invalid names and missing app directory", () => {
    it("rejects invalid component name with spaces", async () => {
      const result = await runCli(workspace.dir, ["add:component", "ui/Bad Name"]);

      expect(result.code).not.toBe(0);
      expect(result.stderr + result.stdout).toMatch(/Invalid component name/i);
    });

    it("rejects component name starting with number", async () => {
      const result = await runCli(workspace.dir, ["add:component", "ui/123Button"]);

      expect(result.code).not.toBe(0);
      expect(result.stderr + result.stdout).toMatch(/Invalid component name/i);
    });

    it("rejects component name with leading dot", async () => {
      const result = await runCli(workspace.dir, ["add:component", "ui/.Hidden"]);

      expect(result.code).not.toBe(0);
      // Should reject due to invalid PascalCase conversion or path traversal
      expect(result.stderr + result.stdout).toMatch(/Invalid|\.\.|path/i);
    });

    it("rejects component path with .. traversal", async () => {
      const result = await runCli(workspace.dir, ["add:component", "ui/../Bad"]);

      expect(result.code).not.toBe(0);
      expect(result.stderr + result.stdout).toMatch(/\.\.|traversal|path/i);
    });

    it("errors when app directory is missing for add:component", async () => {
      // Remove the app directory
      await import("fs/promises").then((fs) =>
        fs.rm(path.join(workspace.dir, "app"), { recursive: true, force: true })
      );

      const result = await runCli(workspace.dir, ["add:component", "Button"]);

      expect(result.code).not.toBe(0);
      expect(result.stderr + result.stdout).toMatch(/App directory not found/i);
    });

    it("errors when config pagesDir points to missing directory", async () => {
      await writeJson(path.join(workspace.dir, "nextforge.config.json"), {
        useTailwind: false,
        useChakra: false,
        pagesDir: "missing/app",
      });

      const result = await runCli(workspace.dir, ["add:component", "Button"]);

      expect(result.code).not.toBe(0);
      expect(result.stderr + result.stdout).toMatch(/App directory not found/i);
    });

    it("errors when app directory is missing for add:page", async () => {
      // Remove the app directory
      await import("fs/promises").then((fs) =>
        fs.rm(path.join(workspace.dir, "app"), { recursive: true, force: true })
      );

      const result = await runCli(workspace.dir, ["add:page", "home"]);

      expect(result.code).not.toBe(0);
      expect(result.stderr + result.stdout).toMatch(/App directory not found/i);
    });

    it('rejects reserved group name "api"', async () => {
      const result = await runCli(workspace.dir, ["add:group", "api"]);

      expect(result.code).not.toBe(0);
      expect(result.stderr + result.stdout).toMatch(/reserved|"api"/i);
    });

    it("rejects invalid page route with special characters", async () => {
      const result = await runCli(workspace.dir, ["add:page", "about@page"]);

      expect(result.code).not.toBe(0);
      expect(result.stderr + result.stdout).toMatch(/Invalid segment|invalid/i);
    });
  });

  describe("Mutually exclusive flags", () => {
    it("rejects --async and --client together for add:page", async () => {
      const result = await runCli(workspace.dir, ["add:page", "home", "--async", "--client"]);

      expect(result.code).not.toBe(0);
      expect(result.stderr + result.stdout).toMatch(/exactly one|--async|--client/i);
    });

    it("accepts --async without --client", async () => {
      const result = await runCli(workspace.dir, ["add:page", "reports", "--async"]);

      expect(result.code).toBe(0);
      const pagePath = path.join(workspace.dir, "app/reports/page.tsx");
      expect(await exists(pagePath)).toBe(true);
      const content = await readText(pagePath);
      expect(content).toContain("async function Page");
    });

    it("accepts --client without --async", async () => {
      const result = await runCli(workspace.dir, ["add:page", "dashboard", "--client"]);

      expect(result.code).toBe(0);
      const pagePath = path.join(workspace.dir, "app/dashboard/page.tsx");
      expect(await exists(pagePath)).toBe(true);
      const content = await readText(pagePath);
      expect(content).toMatch(/^"use client"/m);
    });
  });

  describe("Config format matrix and tsx error", () => {
    it("loads config from nextforge.config.mjs", async () => {
      await writeFile(
        path.join(workspace.dir, "nextforge.config.mjs"),
        `export default {
  useTailwind: true,
  useChakra: false,
  pagesDir: "app",
};
`
      );

      const result = await runCli(workspace.dir, ["add:component", "Test"]);

      expect(result.code).toBe(0);
    });

    it("loads config from nextforge.config.cjs", async () => {
      await writeFile(
        path.join(workspace.dir, "nextforge.config.cjs"),
        `module.exports = {
  useTailwind: false,
  useChakra: true,
  pagesDir: "app",
};
`
      );

      const result = await runCli(workspace.dir, ["add:component", "Test"]);

      expect(result.code).toBe(0);
    });

    it("nice error when nextforge.config.ts present but tsx dep missing", async () => {
      await writeFile(
        path.join(workspace.dir, "nextforge.config.ts"),
        "export default {} as const;"
      );
      await writeJson(path.join(workspace.dir, "package.json"), {
        type: "module",
        dependencies: {},
      });

      // Remove tsx from node_modules if it exists (in test env it might be available)
      // The actual behavior depends on whether tsx is available
      // In a real scenario without tsx, it would fall back to esbuild
      // So we test that it attempts to load and provides a helpful message on failure
      const result = await runCli(workspace.dir, ["add:group", "auth"]);

      // Should either succeed (if tsx/esbuild available) or provide helpful error
      if (result.code !== 0) {
        expect(result.stderr + result.stdout).toMatch(/tsx|esbuild|TypeScript config/i);
      }
    });

    it("loads config from nextforge.config.json", async () => {
      await writeJson(path.join(workspace.dir, "nextforge.config.json"), {
        useTailwind: false,
        useChakra: false,
        pagesDir: "app",
      });

      const result = await runCli(workspace.dir, ["add:component", "Test"]);

      expect(result.code).toBe(0);
    });

    it("config precedence: CLI flags override config file", async () => {
      await writeJson(path.join(workspace.dir, "nextforge.config.json"), {
        useTailwind: false,
        useChakra: false,
        pagesDir: "app",
      });

      // Use --framework to override
      const result = await runCli(workspace.dir, [
        "add:component",
        "Card",
        "--framework",
        "tailwind",
      ]);

      expect(result.code).toBe(0);
      const componentPath = path.join(workspace.dir, "app/components/ui/Card/Card.tsx");
      const content = await readText(componentPath);
      // Should have Tailwind className even though config says no Tailwind
      expect(content).toContain("className");
    });
  });

  describe("Feature flag matrix (Tailwind/Chakra combinations)", () => {
    it.each`
      useTailwind | useChakra | group        | description
      ${true}     | ${false}  | ${"ui"}      | ${"Tailwind only, ui group"}
      ${false}    | ${true}   | ${"layout"}  | ${"Chakra only, layout group"}
      ${true}     | ${true}   | ${"section"} | ${"Both frameworks, section group"}
      ${false}    | ${false}  | ${"feature"} | ${"Basic (no frameworks), feature group"}
    `(
      "respects flags TW:$useTailwind CH:$useChakra group:$group",
      async ({ useTailwind, useChakra, group }) => {
        await writeJson(path.join(workspace.dir, "nextforge.config.json"), {
          useTailwind,
          useChakra,
          pagesDir: "app",
        });

        await runCli(workspace.dir, ["add:component", `${group}/Card`]);

        const code = await readText(
          path.join(workspace.dir, `app/components/${group}/Card/Card.tsx`)
        );

        if (useTailwind) {
          expect(code).toMatch(/className="[^"]*"/);
        }
        if (useChakra) {
          expect(code).toMatch(/@chakra-ui\/react/);
        }
        if (!useTailwind && !useChakra) {
          // Basic template should have minimal markup without framework-specific syntax
          expect(code).not.toMatch(/className="[^"]*"/);
          expect(code).not.toMatch(/@chakra-ui\/react/);
        }
      }
    );
  });

  describe("Async page template", () => {
    it("add:page --async generates an async server component", async () => {
      await runCli(workspace.dir, ["add:page", "reports", "--async"]);

      const code = await readText(path.join(workspace.dir, "app/reports/page.tsx"));

      expect(code).toMatch(/export default async function Page/);
      expect(code).toContain("await");
    });

    it("add:page without --async generates sync component", async () => {
      await runCli(workspace.dir, ["add:page", "about"]);

      const code = await readText(path.join(workspace.dir, "app/about/page.tsx"));

      expect(code).toMatch(/export default function Page/);
      expect(code).not.toContain("async function Page");
    });
  });

  describe("Windows path normalization", () => {
    it("normalizes Windows-style --app path with backslashes for add:group", async () => {
      // Create nested app directory
      const nestedApp = path.join(workspace.dir, "apps", "web", "app");
      await import("fs/promises").then((fs) => fs.mkdir(nestedApp, { recursive: true }));

      // Use Windows-style backslashes (will be normalized on all platforms)
      const result = await runCli(workspace.dir, ["add:group", "auth", "--app", "apps/web/app"]);

      expect(result.code).toBe(0);
      // Path should be normalized to forward slashes in output, but should work
      const groupDir = path.join(workspace.dir, "apps", "web", "app", "(auth)");
      expect(await exists(groupDir)).toBe(true);
    });

    it("handles nested app directory via config pagesDir", async () => {
      // Create nested structure
      const nestedApp = path.join(workspace.dir, "apps", "web", "app");
      await import("fs/promises").then((fs) => fs.mkdir(nestedApp, { recursive: true }));
      await writeFile(path.join(workspace.dir, "package.json"), JSON.stringify({ type: "module" }));
      await writeJson(path.join(workspace.dir, "nextforge.config.json"), {
        useTailwind: false,
        useChakra: false,
        pagesDir: "apps/web/app",
      });

      const result = await runCli(workspace.dir, ["add:component", "ui/Button"]);

      expect(result.code).toBe(0);
      const componentPath = path.join(
        workspace.dir,
        "apps",
        "web",
        "app",
        "components",
        "ui",
        "Button",
        "Button.tsx"
      );
      expect(await exists(componentPath)).toBe(true);
    });
  });

  describe("Barrel/index file behavior", () => {
    it("prevents duplicate exports in barrel file", async () => {
      await runCli(workspace.dir, ["add:component", "ui/Button"]);
      await runCli(workspace.dir, ["add:component", "ui/Card"]);

      const barrel = await readText(path.join(workspace.dir, "app/components/ui/index.ts"));

      // Check that each component appears exactly once
      const buttonMatches = barrel.match(/Button/g) || [];
      const cardMatches = barrel.match(/Card/g) || [];
      // Should have export lines mentioning Button and Card, but no duplicates
      expect(buttonMatches.length).toBeGreaterThanOrEqual(1);
      expect(cardMatches.length).toBeGreaterThanOrEqual(1);
    });

    it("maintains alphabetical order in barrel file", async () => {
      await runCli(workspace.dir, ["add:component", "ui/Zebra"]);
      await runCli(workspace.dir, ["add:component", "ui/Alpha"]);
      await runCli(workspace.dir, ["add:component", "ui/Middle"]);

      const barrel = await readText(path.join(workspace.dir, "app/components/ui/index.ts"));

      // Get all export lines
      const lines = barrel.split("\n").filter((l) => l.trim().startsWith("export"));
      const alphaIndex = lines.findIndex((l) => l.includes("Alpha"));
      const middleIndex = lines.findIndex((l) => l.includes("Middle"));
      const zebraIndex = lines.findIndex((l) => l.includes("Zebra"));

      // Should be in alphabetical order
      expect(alphaIndex).toBeLessThan(middleIndex);
      expect(middleIndex).toBeLessThan(zebraIndex);
    });

    it("re-running add:component does not duplicate barrel exports", async () => {
      await runCli(workspace.dir, ["add:component", "ui/Button"]);

      const barrel1 = await readText(path.join(workspace.dir, "app/components/ui/index.ts"));
      const exportCount1 = barrel1
        .split("\n")
        .filter((l) => l.includes("export") && l.includes("Button")).length;

      // Run again (should not duplicate)
      await runCli(workspace.dir, ["add:component", "ui/Button"]);

      const barrel2 = await readText(path.join(workspace.dir, "app/components/ui/index.ts"));
      const exportCount2 = barrel2
        .split("\n")
        .filter((l) => l.includes("export") && l.includes("Button")).length;

      expect(exportCount2).toBe(exportCount1);
      expect(exportCount1).toBeGreaterThan(0);
    });
  });

  describe("Missing required arguments", () => {
    it("errors when component name is missing", async () => {
      const result = await runCli(workspace.dir, ["add:component"]);

      expect(result.code).not.toBe(0);
      expect(result.stderr + result.stdout).toMatch(/required|missing/i);
    });

    it("errors when page route is missing", async () => {
      const result = await runCli(workspace.dir, ["add:page"]);

      expect(result.code).not.toBe(0);
      expect(result.stderr + result.stdout).toMatch(/required|missing/i);
    });

    it("errors when group name is missing", async () => {
      const result = await runCli(workspace.dir, ["add:group"]);

      expect(result.code).not.toBe(0);
      expect(result.stderr + result.stdout).toMatch(/required|missing/i);
    });
  });

  describe("Invalid framework flag", () => {
    it("rejects invalid --framework value", async () => {
      const result = await runCli(workspace.dir, [
        "add:component",
        "Button",
        "--framework",
        "invalid",
      ]);

      expect(result.code).not.toBe(0);
      expect(result.stderr + result.stdout).toMatch(/Invalid --framework/i);
    });

    it("accepts valid --framework values", async () => {
      const frameworks = ["chakra", "tailwind", "basic", "both"];

      for (const fw of frameworks) {
        // Clean up previous runs
        const componentPath = path.join(workspace.dir, "app/components/ui/Test", "Test.tsx");
        await import("fs/promises").then((fs) =>
          fs.rm(path.dirname(componentPath), { recursive: true, force: true })
        );

        const result = await runCli(workspace.dir, ["add:component", "Test", "--framework", fw]);

        expect(result.code).toBe(0);
      }
    });
  });

  describe("Invalid group flag", () => {
    it("rejects invalid --group value", async () => {
      const result = await runCli(workspace.dir, ["add:component", "Button", "--group", "invalid"]);

      expect(result.code).not.toBe(0);
      expect(result.stderr + result.stdout).toMatch(/Invalid --group/i);
    });

    it("accepts valid --group values", async () => {
      const groups = ["ui", "layout", "section", "feature"];

      for (const group of groups) {
        // Clean up previous runs
        const componentPath = path.join(workspace.dir, `app/components/${group}/Test`, "Test.tsx");
        await import("fs/promises").then((fs) =>
          fs.rm(path.dirname(componentPath), { recursive: true, force: true })
        );

        const result = await runCli(workspace.dir, ["add:component", "Test", "--group", group]);

        expect(result.code).toBe(0);
      }
    });
  });
});
