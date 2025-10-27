import { describe, it, expect } from "vitest";

import { doctorCommand } from "./doctor.js";

describe("nextforge CLI", () => {
  it("should have doctor command", () => {
    expect(doctorCommand.name()).toBe("doctor");
    expect(doctorCommand.description()).toBe("Run diagnostic checks on your Next.js project");
  });
});
