import { describe, it, expect } from "vitest";

import { main } from "../../src/index.js";

describe("nextforge CLI main", () => {
  it("should export main function", () => {
    expect(typeof main).toBe("function");
  });
});
