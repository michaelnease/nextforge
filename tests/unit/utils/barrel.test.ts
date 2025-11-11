import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdir, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { upsertExport } from "../../../src/utils/barrel.js";

describe("barrel utility", () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary directory for each test
    testDir = join(tmpdir(), `barrel-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up
    await rm(testDir, { recursive: true, force: true });
  });

  it("should create barrel file with Button export using POSIX path", async () => {
    const barrelPath = join(testDir, "components", "ui", "index.ts");
    await mkdir(join(testDir, "components", "ui"), { recursive: true });

    await upsertExport(barrelPath, 'export { default as Button } from "./Button"');

    const content = await readFile(barrelPath, "utf8");
    expect(content).toBe('export { default as Button } from "./Button";\n');
  });

  it("should create barrel file with nested Hero export using POSIX path", async () => {
    const barrelPath = join(testDir, "components", "section", "index.ts");
    await mkdir(join(testDir, "components", "section"), { recursive: true });

    await upsertExport(barrelPath, 'export { default as Hero } from "./Marketing/Hero"');

    const content = await readFile(barrelPath, "utf8");
    expect(content).toBe('export { default as Hero } from "./Marketing/Hero";\n');
  });

  it("should add export to existing barrel file", async () => {
    const barrelPath = join(testDir, "components", "ui", "index.ts");
    await mkdir(join(testDir, "components", "ui"), { recursive: true });

    // Add first export
    await upsertExport(barrelPath, 'export { default as Button } from "./Button"');
    // Add second export
    await upsertExport(barrelPath, 'export { default as Card } from "./Card"');

    const content = await readFile(barrelPath, "utf8");
    // Should be sorted alphabetically by component name
    expect(content).toBe(
      'export { default as Button } from "./Button";\nexport { default as Card } from "./Card";\n'
    );
  });

  it("should not duplicate existing exports", async () => {
    const barrelPath = join(testDir, "components", "ui", "index.ts");
    await mkdir(join(testDir, "components", "ui"), { recursive: true });

    // Add same export twice
    await upsertExport(barrelPath, 'export { default as Button } from "./Button"');
    await upsertExport(barrelPath, 'export { default as Button } from "./Button"');

    const content = await readFile(barrelPath, "utf8");
    // Should only appear once
    expect(content).toBe('export { default as Button } from "./Button";\n');
  });

  it("should sort exports alphabetically by component name", async () => {
    const barrelPath = join(testDir, "components", "ui", "index.ts");
    await mkdir(join(testDir, "components", "ui"), { recursive: true });

    // Add in reverse alphabetical order
    await upsertExport(barrelPath, 'export { default as Zebra } from "./Zebra"');
    await upsertExport(barrelPath, 'export { default as Apple } from "./Apple"');
    await upsertExport(barrelPath, 'export { default as Mango } from "./Mango"');

    const content = await readFile(barrelPath, "utf8");
    // Should be sorted alphabetically
    expect(content).toBe(
      'export { default as Apple } from "./Apple";\n' +
        'export { default as Mango } from "./Mango";\n' +
        'export { default as Zebra } from "./Zebra";\n'
    );
  });

  it("should handle paths with POSIX separators for nested components", async () => {
    const barrelPath = join(testDir, "components", "section", "index.ts");
    await mkdir(join(testDir, "components", "section"), { recursive: true });

    // Test with nested path using POSIX separators
    await upsertExport(barrelPath, 'export { default as Hero } from "./Marketing/Hero"');
    await upsertExport(barrelPath, 'export { default as Banner } from "./Advertising/Banner"');

    const content = await readFile(barrelPath, "utf8");
    // Should maintain POSIX separators and be sorted
    expect(content).toBe(
      'export { default as Banner } from "./Advertising/Banner";\n' +
        'export { default as Hero } from "./Marketing/Hero";\n'
    );
  });

  it("should normalize export lines with or without semicolons", async () => {
    const barrelPath = join(testDir, "components", "ui", "index.ts");
    await mkdir(join(testDir, "components", "ui"), { recursive: true });

    // Add with semicolon
    await upsertExport(barrelPath, 'export { default as Button } from "./Button";');
    // Add without semicolon (should be treated as same)
    await upsertExport(barrelPath, 'export { default as Button } from "./Button"');

    const content = await readFile(barrelPath, "utf8");
    // Should only appear once with semicolon
    expect(content).toBe('export { default as Button } from "./Button";\n');
  });
});
