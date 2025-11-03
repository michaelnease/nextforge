import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { exists, makeTempWorkspace, readText, runCli } from "../utils/tempWorkspace.js";

describe("add:page command E2E tests", () => {
  let workspace: Awaited<ReturnType<typeof makeTempWorkspace>>;

  afterEach(async () => {
    if (workspace) {
      await workspace.cleanup();
    }
  });

  beforeEach(async () => {
    workspace = await makeTempWorkspace();
    const appDir = path.join(workspace.dir, "app");
    await import("fs/promises").then((fs) => fs.mkdir(appDir, { recursive: true }));
  });

  it("static page: add:page about creates app/about/page.tsx", async () => {
    const result = await runCli(workspace.dir, "add:page", "about");

    expect(result.code).toBe(0);
    const pagePath = path.join(workspace.dir, "app", "about", "page.tsx");
    expect(await exists(pagePath)).toBe(true);
    const content = await readText(pagePath);
    expect(content).toContain("export default function Page");
  });

  it("dynamic page: add:page 'blog/[slug]' creates correct folder structure", async () => {
    const result = await runCli(workspace.dir, "add:page", "blog/[slug]");

    expect(result.code).toBe(0);
    const pagePath = path.join(workspace.dir, "app", "blog", "[slug]", "page.tsx");
    expect(await exists(pagePath)).toBe(true);
    const content = await readText(pagePath);
    expect(content).toContain("Slug");
  });

  it("API route only: add:page 'api/users' --api --skip-page creates only route.ts", async () => {
    const result = await runCli(workspace.dir, "add:page", "api/users", "--api", "--skip-page");

    expect(result.code).toBe(0);
    const routePath = path.join(workspace.dir, "app", "api", "users", "route.ts");
    expect(await exists(routePath)).toBe(true);
    const pagePath = path.join(workspace.dir, "app", "api", "users", "page.tsx");
    expect(await exists(pagePath)).toBe(false);
    const content = await readText(routePath);
    expect(content).toContain("export async function GET");
  });

  it("grouped client page: add:page 'profile' --group auth --client --layout has 'use client'", async () => {
    const result = await runCli(
      workspace.dir,
      "add:page",
      "profile",
      "--group",
      "auth",
      "--client",
      "--layout"
    );

    expect(result.code).toBe(0);
    const pagePath = path.join(workspace.dir, "app", "(auth)", "profile", "page.tsx");
    expect(await exists(pagePath)).toBe(true);
    const content = await readText(pagePath);
    expect(content).toMatch(/^"use client"/m);
    expect(await exists(path.join(workspace.dir, "app", "(auth)", "profile", "layout.tsx"))).toBe(
      true
    );
  });

  it("async server page: add:page 'dashboard/data' --async contains async function", async () => {
    const result = await runCli(workspace.dir, "add:page", "dashboard/data", "--async");

    expect(result.code).toBe(0);
    const pagePath = path.join(workspace.dir, "app", "dashboard", "data", "page.tsx");
    expect(await exists(pagePath)).toBe(true);
    const content = await readText(pagePath);
    expect(content).toContain("export default async function Page");
  });

  it("optional catch-all: add:page 'docs/[[...slug]]' creates without errors", async () => {
    const result = await runCli(workspace.dir, "add:page", "docs/[[...slug]]");

    expect(result.code).toBe(0);
    const pagePath = path.join(workspace.dir, "app", "docs", "[[...slug]]", "page.tsx");
    expect(await exists(pagePath)).toBe(true);
  });
});
