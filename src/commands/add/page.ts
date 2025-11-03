import path from "node:path";

import type { Command } from "commander";

import { loadConfig } from "../../config/loadConfig.js";
import { ensureDir, safeWrite } from "../../utils/fsx.js";
import { updatePageManifest } from "../../utils/manifest.js";
import { resolveAppRoot } from "../../utils/resolveAppRoot.js";
import { validatePageRoute } from "../../utils/validate.js";

/**
 * Generate page template based on async/client flags and route segment.
 */
function generatePageTemplate(client: boolean, async: boolean, routeSegment?: string): string {
  // For dynamic routes, extract param name from [slug] or [[...slug]]
  let content = "<div>page</div>";
  if (routeSegment) {
    const match = routeSegment.match(/\[+([^\]]+)\]+/);
    if (match && match[1]) {
      const paramName = match[1].replace("...", "");
      const capitalize = paramName.charAt(0).toUpperCase() + paramName.slice(1);
      content = `<div>${capitalize}</div>`;
    }
  }

  if (client) {
    return `"use client";

export default function Page() {
  return ${content};
}
`;
  }

  if (async) {
    return `export default async function Page() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  return ${content};
}
`;
  }

  // Sync server component
  return `export default function Page() {
  return ${content};
}
`;
}

/**
 * Generate layout template based on client flag.
 */
function generateLayoutTemplate(client: boolean): string {
  const clientDirective = client ? '"use client";\n\n' : "";
  return `${clientDirective}export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
`;
}

/**
 * Generate API route template.
 */
function generateApiRouteTemplate(): string {
  return `import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true });
}
`;
}

/**
 * Generate page test template.
 */
function generatePageTestTemplate(route: string): string {
  return `import Page from "../page";
import { render, screen } from "@testing-library/react";

describe("page ${route}", () => {
  it("renders", () => {
    render(<Page />);
    expect(screen.getByText(/page/i)).toBeTruthy();
  });
});
`;
}

export function registerAddPage(program: Command) {
  program
    .command("add:page")
    .description("Create a page under app/")
    .argument("<route>", "Route path like 'reports' or 'account/settings'")
    .option("--app <dir>", "App directory (default: app)")
    .option("--async", "Generate an async server component", false)
    .option("--client", "Generate a client component", false)
    .option("--force", "Overwrite existing files", false)
    .option("--layout", "Create layout.tsx", false)
    .option("--api", "Create API route (route.ts)", false)
    .option("--skip-page", "Skip creating page.tsx (use with --api)", false)
    .option("--group <name>", "Wrap in route group, e.g., auth creates (auth)/route")
    .option("--with-tests", "Create test file", false)
    .action(
      async (
        route: string,
        opts: {
          app?: string;
          async?: boolean;
          client?: boolean;
          force?: boolean;
          layout?: boolean;
          api?: boolean;
          skipPage?: boolean;
          group?: string;
          withTests?: boolean;
        }
      ) => {
        try {
          // Check mutually exclusive flags
          if (opts.async && opts.client) {
            console.error("Choose exactly one of --async or --client");
            process.exitCode = 1;
            return;
          }

          // Validate route
          try {
            validatePageRoute(route);
          } catch (err) {
            if (err instanceof Error && err.message === "Invalid segment") {
              console.error("Invalid segment");
              process.exitCode = 1;
              return;
            }
            throw err;
          }

          // Load config and resolve app directory
          const config = await loadConfig(process.cwd());
          const appDir = await resolveAppRoot({
            ...(opts.app && { appFlag: opts.app }),
            ...(config.pagesDir && { configPagesDir: config.pagesDir }),
            createIfMissing: false, // pages must error if the app dir is missing
          });

          // Generate page path with optional route group
          let routeSegments = route.split("/").filter(Boolean);
          if (opts.group) {
            // Wrap in route group: (groupName)
            const groupName = opts.group.startsWith("(") ? opts.group : `(${opts.group})`;
            routeSegments = [groupName, ...routeSegments];
          }
          const pageDir = path.join(appDir, ...routeSegments);
          await ensureDir(pageDir);

          // Write page file unless --skip-page is set
          if (!opts.skipPage) {
            const pagePath = path.join(pageDir, "page.tsx");
            const lastSegment = routeSegments[routeSegments.length - 1];
            const template = generatePageTemplate(!!opts.client, !!opts.async, lastSegment);
            await safeWrite(pagePath, template, opts.force ? { force: true } : {});
          }

          // Write layout file if --layout is set
          if (opts.layout) {
            const layoutPath = path.join(pageDir, "layout.tsx");
            const layoutTemplate = generateLayoutTemplate(!!opts.client);
            await safeWrite(layoutPath, layoutTemplate, opts.force ? { force: true } : {});
          }

          // Write API route file if --api is set
          if (opts.api) {
            const apiPath = path.join(pageDir, "route.ts");
            const apiTemplate = generateApiRouteTemplate();
            await safeWrite(apiPath, apiTemplate, opts.force ? { force: true } : {});
          }

          // Write test file if --with-tests is set
          if (opts.withTests) {
            const testDir = path.join(pageDir, "__tests__");
            await ensureDir(testDir);
            const testPath = path.join(testDir, "page.test.tsx");
            const testTemplate = generatePageTestTemplate(route);
            await safeWrite(testPath, testTemplate, opts.force ? { force: true } : {});
          }

          // Update page manifest
          const manifestRoute = routeSegments.join("/");
          await updatePageManifest(appDir, manifestRoute);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("Invalid segment") || msg.toLowerCase().includes("invalid")) {
            console.error("Invalid segment");
            process.exitCode = 1;
            throw err; // Re-throw for tests
          } else if (msg.includes("App directory not found")) {
            console.error(msg);
            process.exitCode = 1;
            throw err; // Re-throw for tests
          } else {
            console.error(msg);
            process.exitCode = 1;
            throw err; // Re-throw for tests
          }
        }
      }
    );
}
