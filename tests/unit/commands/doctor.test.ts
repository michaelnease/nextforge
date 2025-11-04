import { describe, it, expect } from "vitest";

import { doctorCommand } from "../../../src/commands/doctor.js";

describe("nextforge CLI", () => {
  it("should have doctor command", () => {
    expect(doctorCommand.name()).toBe("doctor");
    expect(doctorCommand.description()).toBe("Run health checks for your NextForge setup");
  });
});
