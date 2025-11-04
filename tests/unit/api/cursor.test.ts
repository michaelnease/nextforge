import { join } from "node:path";

import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { createCursorRules, createCursorPhase } from "../../../src/api/cursor.js";
import { makeTempWorkspace, readText } from "../../utils/tempWorkspace.js";

describe("createCursorRules", () => {
  let ws: Awaited<ReturnType<typeof makeTempWorkspace>>;
  let originalCwd: string;

  beforeEach(async () => {
    ws = await makeTempWorkspace();
    originalCwd = process.cwd();
    process.chdir(ws.dir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await ws.cleanup();
  });

  it("should export createCursorRules function", () => {
    expect(typeof createCursorRules).toBe("function");
  });

  it("creates rules file with valid kebab-case name", async () => {
    const filePath = await createCursorRules({ name: "test-rules" });

    expect(filePath).toContain("test-rules.rules.json");
    const content = await readText(filePath);
    const parsed = JSON.parse(content);
    expect(parsed.name).toBe("test-rules");
    expect(parsed.$schema).toBe("https://schemas.nextforge.dev/cursor-rules.v1.json");
  });

  it("creates rules file in MDX format when specified", async () => {
    const filePath = await createCursorRules({ name: "mdx-rules", format: "mdx" });

    expect(filePath).toContain("mdx-rules.rules.mdx");
    const content = await readText(filePath);
    expect(content).toContain("---");
    expect(content).toContain("type: rules");
    expect(content).toContain("name: mdx-rules");
  });

  it("throws error for non-kebab-case names", async () => {
    await expect(createCursorRules({ name: "MyComponent" })).rejects.toThrow(
      'Invalid --name. Use kebab-case (e.g. "component-rules")'
    );

    await expect(createCursorRules({ name: "my_component" })).rejects.toThrow(
      'Invalid --name. Use kebab-case (e.g. "component-rules")'
    );

    await expect(createCursorRules({ name: "my component" })).rejects.toThrow(
      'Invalid --name. Use kebab-case (e.g. "component-rules")'
    );
  });

  it("uses custom cursor directory when specified", async () => {
    const filePath = await createCursorRules({
      name: "custom-dir",
      cursorDir: ".custom/cursor",
    });

    expect(filePath).toContain(".custom/cursor/rules/custom-dir.rules.json");
  });

  it("skips existing files by default", async () => {
    const firstPath = await createCursorRules({ name: "duplicate" });
    expect(firstPath).toContain("duplicate.rules.json");

    // Second call should return same path but not overwrite
    const secondPath = await createCursorRules({ name: "duplicate" });
    expect(secondPath).toBe(firstPath);
  });

  it("overwrites existing files when force is true", async () => {
    const firstPath = await createCursorRules({ name: "force-test" });
    const firstContent = await readText(firstPath);

    // Modify the file manually
    const { writeFile } = await import("node:fs/promises");
    await writeFile(firstPath, "modified", "utf8");

    // Call with force
    const secondPath = await createCursorRules({ name: "force-test", force: true });
    const secondContent = await readText(secondPath);

    expect(secondPath).toBe(firstPath);
    expect(secondContent).not.toBe("modified");
    expect(JSON.parse(secondContent).name).toBe("force-test");
  });

  it("returns absolute path to created file", async () => {
    const filePath = await createCursorRules({ name: "absolute-path" });

    const { isAbsolute } = await import("node:path");
    expect(isAbsolute(filePath)).toBe(true);
  });

  it("creates index.json with proper metadata", async () => {
    await createCursorRules({ name: "indexed-rule" });

    const indexPath = join(ws.dir, ".nextforge/cursor/index.json");
    const indexContent = await readText(indexPath);
    const index = JSON.parse(indexContent);

    expect(Array.isArray(index)).toBe(true);
    const entry = index.find((item: { name: string }) => item.name === "indexed-rule");
    expect(entry).toBeDefined();
    expect(entry.type).toBe("rules");
    expect(entry.format).toBe("json");
    expect(entry.createdAt).toBeDefined();
  });
});

describe("createCursorPhase", () => {
  let ws: Awaited<ReturnType<typeof makeTempWorkspace>>;
  let originalCwd: string;

  beforeEach(async () => {
    ws = await makeTempWorkspace();
    originalCwd = process.cwd();
    process.chdir(ws.dir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await ws.cleanup();
  });

  it("should export createCursorPhase function", () => {
    expect(typeof createCursorPhase).toBe("function");
  });

  it("creates phase file with valid positive integer", async () => {
    const filePath = await createCursorPhase({ phase: 1 });

    expect(filePath).toContain("phase-1.json");
    const content = await readText(filePath);
    const parsed = JSON.parse(content);
    expect(parsed.phase).toBe(1);
    expect(parsed.$schema).toBe("https://schemas.nextforge.dev/cursor-phase.v1.json");
  });

  it("creates phase file in MDX format when specified", async () => {
    const filePath = await createCursorPhase({ phase: 2, format: "mdx" });

    expect(filePath).toContain("phase-2.mdx");
    const content = await readText(filePath);
    expect(content).toContain("---");
    expect(content).toContain("type: phase");
    expect(content).toContain("phase: 2");
  });

  it("throws error for invalid phase numbers", async () => {
    await expect(createCursorPhase({ phase: 0 })).rejects.toThrow(
      "Invalid --phase. Provide a positive integer (e.g. --phase 3)"
    );

    await expect(createCursorPhase({ phase: -1 })).rejects.toThrow(
      "Invalid --phase. Provide a positive integer (e.g. --phase 3)"
    );

    await expect(createCursorPhase({ phase: 1.5 })).rejects.toThrow(
      "Invalid --phase. Provide a positive integer (e.g. --phase 3)"
    );
  });

  it("uses custom cursor directory when specified", async () => {
    const filePath = await createCursorPhase({
      phase: 5,
      cursorDir: ".custom/phases",
    });

    expect(filePath).toContain(".custom/phases/phases/phase-5.json");
  });

  it("skips existing files by default", async () => {
    const firstPath = await createCursorPhase({ phase: 10 });
    expect(firstPath).toContain("phase-10.json");

    // Second call should return same path but not overwrite
    const secondPath = await createCursorPhase({ phase: 10 });
    expect(secondPath).toBe(firstPath);
  });

  it("overwrites existing files when force is true", async () => {
    const firstPath = await createCursorPhase({ phase: 3 });
    const firstContent = await readText(firstPath);

    // Modify the file manually
    const { writeFile } = await import("node:fs/promises");
    await writeFile(firstPath, "modified", "utf8");

    // Call with force
    const secondPath = await createCursorPhase({ phase: 3, force: true });
    const secondContent = await readText(secondPath);

    expect(secondPath).toBe(firstPath);
    expect(secondContent).not.toBe("modified");
    expect(JSON.parse(secondContent).phase).toBe(3);
  });

  it("returns absolute path to created file", async () => {
    const filePath = await createCursorPhase({ phase: 7 });

    const { isAbsolute } = await import("node:path");
    expect(isAbsolute(filePath)).toBe(true);
  });

  it("creates index.json with proper metadata", async () => {
    await createCursorPhase({ phase: 8 });

    const indexPath = join(ws.dir, ".nextforge/cursor/index.json");
    const indexContent = await readText(indexPath);
    const index = JSON.parse(indexContent);

    expect(Array.isArray(index)).toBe(true);
    const entry = index.find((item: { name: string }) => item.name === "phase-8");
    expect(entry).toBeDefined();
    expect(entry.type).toBe("phases");
    expect(entry.format).toBe("json");
    expect(entry.createdAt).toBeDefined();
  });
});
