import { exec } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execAsync = promisify(exec);

/**
 * CI verification tests.
 * NOTE: These tests are excluded from normal test runs via vitest.config.ts to prevent infinite loops.
 * Run manually with: vitest run tests/e2e/verify.e2e.test.ts --config vitest.config.verify.ts
 */
describe("CI verification tests", () => {
  it("npm build exits successfully", async () => {
    const { stdout, stderr } = await execAsync("npm run build", {
      cwd: process.cwd(),
    });

    expect(stdout || stderr).toBeDefined();
    // Build should complete without throwing
  }, 60000);

  it("npm test:run passes (excluding verify tests)", async () => {
    // The verify.e2e.test.ts is excluded in vitest.config.ts, so this won't cause recursion
    const { stdout, stderr } = await execAsync("npm run test:run", {
      cwd: process.cwd(),
    });

    expect(stdout || stderr).toBeDefined();
    // Tests should pass
  }, 120000);

  it("npm smoke runs without throwing", async () => {
    const { stdout, stderr } = await execAsync("npm run smoke", {
      cwd: process.cwd(),
    });

    expect(stdout || stderr).toBeDefined();
    // Smoke test should complete
  }, 60000);
});
