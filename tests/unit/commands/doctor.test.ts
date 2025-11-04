import { describe, it, expect } from "vitest";

import { doctorCommand } from "../../../src/commands/doctor.js";
import {
  nodeVersionCheck,
  tsxLoaderCheck,
  appDirCheck,
  zshQuotingCheck,
} from "../../../src/utils/doctor/checks.js";

describe("nextforge doctor", () => {
  it("should have doctor command", () => {
    expect(doctorCommand.name()).toBe("doctor");
    expect(doctorCommand.description()).toBe("Run health checks for your NextForge setup");
  });

  describe("nodeVersionCheck", () => {
    it("should pass when Node version satisfies engines.node", async () => {
      const result = await nodeVersionCheck.run({
        cwd: process.cwd(),
        flags: {},
      });
      expect(result.status).toBe("pass");
      expect(result.message).toContain("satisfies engines.node");
    });
  });

  describe("tsxLoaderCheck", () => {
    it("should handle when tsx is installed locally", async () => {
      const result = await tsxLoaderCheck.run({
        cwd: process.cwd(),
        flags: {},
      });
      // Should pass or say no config found
      expect(["pass"]).toContain(result.status);
    });
  });

  describe("appDirCheck", () => {
    it("should detect app directory or fail gracefully", async () => {
      const result = await appDirCheck.run({
        cwd: process.cwd(),
        flags: {},
      });
      // Should pass, warn (multiple candidates), or fail, but not throw
      expect(["pass", "warn", "fail"]).toContain(result.status);
      if (result.status === "fail") {
        expect(result.fix).toBeDefined();
        expect(result.fix?.length).toBeGreaterThan(0);
      }
    });
  });

  describe("zshQuotingCheck", () => {
    it("should handle zsh detection", async () => {
      const result = await zshQuotingCheck.run({
        cwd: process.cwd(),
        flags: {},
      });
      // Should always return a result
      expect(["pass", "warn"]).toContain(result.status);
    });
  });
});
