import { existsSync } from "node:fs";

import { describe, it, expect } from "vitest";

describe("Build smoke test", () => {
  it("should have built dist/index.js with main function", async () => {
    expect(existsSync("dist/index.js")).toBe(true);
    expect(existsSync("dist/index.d.ts")).toBe(true);

    // Use dynamic import to avoid build-time resolution issues
    const mod = await import("../dist/index.js");
    expect(typeof mod.main).toBe("function");
  });
});
