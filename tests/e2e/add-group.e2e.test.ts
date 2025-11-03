import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { exists, makeTempWorkspace, readText, runCli } from "../utils/tempWorkspace.js";

describe("add:group command E2E tests", () => {
  let workspace: Awaited<ReturnType<typeof makeTempWorkspace>>;

  afterEach(async () => {
    if (workspace) {
      await workspace.cleanup();
    }
  });

  it("basic: add:group auth creates app/(auth)/README.md", async () => {
    workspace = await makeTempWorkspace();
    const appDir = path.join(workspace.dir, "app");
    await import("fs/promises").then((fs) => fs.mkdir(appDir, { recursive: true }));

    const result = await runCli(workspace.dir, "add:group", "auth");

    expect(result.code).toBe(0);
    const readmePath = path.join(workspace.dir, "app", "(auth)", "README.md");
    expect(await exists(readmePath)).toBe(true);
    const content = await readText(readmePath);
    expect(content).toContain("auth");
    expect(content).toContain("route group");
  });

  it("with layout: add:group auth --with-layout creates layout file", async () => {
    workspace = await makeTempWorkspace();
    const appDir = path.join(workspace.dir, "app");
    await import("fs/promises").then((fs) => fs.mkdir(appDir, { recursive: true }));

    const result = await runCli(workspace.dir, "add:group", "auth", "--with-layout");

    expect(result.code).toBe(0);
    const layoutPath = path.join(workspace.dir, "app", "(auth)", "layout.tsx");
    expect(await exists(layoutPath)).toBe(true);
    const content = await readText(layoutPath);
    expect(content).toContain("GroupLayout");
  });

  it("with pages: add:group auth --pages signin,signup,[slug] creates pages", async () => {
    workspace = await makeTempWorkspace();
    const appDir = path.join(workspace.dir, "app");
    await import("fs/promises").then((fs) => fs.mkdir(appDir, { recursive: true }));

    const result = await runCli(
      workspace.dir,
      "add:group",
      "auth",
      "--pages",
      "signin,signup,[slug]"
    );

    expect(result.code).toBe(0);
    expect(await exists(path.join(workspace.dir, "app", "(auth)", "signin", "page.tsx"))).toBe(
      true
    );
    expect(await exists(path.join(workspace.dir, "app", "(auth)", "signup", "page.tsx"))).toBe(
      true
    );
    expect(await exists(path.join(workspace.dir, "app", "(auth)", "[slug]", "page.tsx"))).toBe(
      true
    );
  });

  it("nested: add:group dashboard --app apps/web/app creates missing app dir", async () => {
    workspace = await makeTempWorkspace();

    const result = await runCli(
      workspace.dir,
      "add:group",
      "dashboard",
      "--app",
      "apps/web/app",
      "--pages",
      "overview,settings"
    );

    expect(result.code).toBe(0);
    const appDir = path.join(workspace.dir, "apps", "web", "app");
    expect(await exists(appDir)).toBe(true);
    expect(await exists(path.join(appDir, "(dashboard)", "overview", "page.tsx"))).toBe(true);
    expect(await exists(path.join(appDir, "(dashboard)", "settings", "page.tsx"))).toBe(true);
  });

  it("force overwrite: add:group auth --force overwrites without error", async () => {
    workspace = await makeTempWorkspace();
    const appDir = path.join(workspace.dir, "app");
    await import("fs/promises").then((fs) => fs.mkdir(appDir, { recursive: true }));

    // Create first time
    await runCli(workspace.dir, "add:group", "auth");

    // Force overwrite
    const result = await runCli(workspace.dir, "add:group", "auth", "--force");

    expect(result.code).toBe(0);
    expect(await exists(path.join(workspace.dir, "app", "(auth)", "README.md"))).toBe(true);
  });

  it("invalid path (--app ../evil) fails with clean message", async () => {
    workspace = await makeTempWorkspace();
    const appDir = path.join(workspace.dir, "app");
    await import("fs/promises").then((fs) => fs.mkdir(appDir, { recursive: true }));

    const result = await runCli(workspace.dir, "add:group", "auth", "--app", "../evil");

    expect(result.code).toBe(1);
    expect(result.stderr.toLowerCase()).toMatch(/unsafe|refusing/i);
  });
});
