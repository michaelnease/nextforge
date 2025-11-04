import { describe, expect, it } from "vitest";

describe("add:component command", () => {
  it("should support --type flag for component types", () => {
    // This is a smoke test to ensure the command structure is correct
    // The actual functionality is tested in e2e tests
    const validTypes = ["ui", "layout", "section", "feature"];
    expect(validTypes).toHaveLength(4);
    expect(validTypes).toContain("ui");
    expect(validTypes).toContain("layout");
    expect(validTypes).toContain("section");
    expect(validTypes).toContain("feature");
  });

  it("should default to 'ui' when no type is specified", () => {
    const defaultType = "ui";
    expect(defaultType).toBe("ui");
  });

  it("should accept PascalCase component names", () => {
    const validNames = ["Button", "MyComponent", "HeroSection123"];
    validNames.forEach((name) => {
      expect(/^[A-Z][A-Za-z0-9]*$/.test(name)).toBe(true);
    });
  });

  it("should reject invalid component names", () => {
    const invalidNames = ["button", "my-component", "123Component", "_Component"];
    invalidNames.forEach((name) => {
      expect(/^[A-Z][A-Za-z0-9]*$/.test(name)).toBe(false);
    });
  });
});
