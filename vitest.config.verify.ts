import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    pool: "forks",
    include: ["tests/e2e/verify.e2e.test.ts"],
    exclude: ["node_modules", "dist", ".idea", ".git", ".cache"],
  },
});
