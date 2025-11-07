import { describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  safePayload,
  currentMode,
  setLogDataMode,
  setExtraRedactKeys,
} from "../../../src/utils/log-data.js";

describe("log-data", () => {
  describe("safePayload", () => {
    it("redacts sensitive key names", () => {
      const payload = {
        username: "alice",
        password: "secret123",
        apiKey: "abc-def-ghi",
        email: "alice@example.com",
      };

      const result = safePayload(payload);

      expect(result.preview).toContain("alice");
      expect(result.preview).toContain("alice@example.com");
      expect(result.preview).toContain("[REDACTED]");
      expect(result.preview).not.toContain("secret123");
      expect(result.preview).not.toContain("abc-def-ghi");
    });

    it("redacts sensitive value patterns (JWT)", () => {
      const payload = {
        token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123",
      };

      const result = safePayload(payload);

      expect(result.preview).toContain("[REDACTED]");
      expect(result.preview).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
    });

    it("redacts AWS keys", () => {
      const payload = {
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      };

      const result = safePayload(payload);

      expect(result.preview).toContain("[REDACTED]");
      expect(result.preview).not.toContain("AKIAIOSFODNN7EXAMPLE");
      expect(result.preview).not.toContain("wJalrXUtnFEMI");
    });

    it("truncates large payloads and reports byte count", () => {
      // Use a string that won't match sensitive patterns (includes spaces)
      const largeString = "a b ".repeat(500);
      const payload = { data: largeString };

      const result = safePayload(payload, { maxPreviewBytes: 100 });

      expect(result.bytes).toBeGreaterThan(1000);
      expect(result.preview.length).toBeLessThan(150); // Truncated + overflow message
      expect(result.preview).toContain("more bytes");
    });

    it("handles multibyte characters correctly", () => {
      // Test with emoji and other multibyte chars
      const payload = {
        message: "Hello 世界 🌍",
        data: "Test with émojis 🎉",
      };

      const result = safePayload(payload);

      // UTF-8: 世 = 3 bytes, 界 = 3 bytes, 🌍 = 4 bytes, 🎉 = 4 bytes
      expect(result.bytes).toBeGreaterThan(payload.message.length);
      expect(result.preview).toContain("世界");
      expect(result.preview).toContain("🌍");
    });

    it("respects noRedact option", () => {
      const payload = {
        password: "secret123",
        apiKey: "abc-def-ghi",
      };

      const result = safePayload(payload, { noRedact: true });

      expect(result.preview).toContain("secret123");
      expect(result.preview).toContain("abc-def-ghi");
      expect(result.preview).not.toContain("[REDACTED]");
    });

    it("generates consistent hashes for same content", () => {
      const payload = { foo: "bar", baz: 123 };

      const result1 = safePayload(payload);
      const result2 = safePayload(payload);

      expect(result1.hash).toBe(result2.hash);
      expect(result1.hash).toHaveLength(16); // SHA256 truncated to 16 chars
    });

    it("handles circular references", () => {
      const payload: Record<string, unknown> = { foo: "bar" };
      payload.self = payload;

      const result = safePayload(payload);

      expect(result.preview).toContain("[Circular]");
      expect(result.preview).toContain("bar");
    });

    it("redacts nested objects", () => {
      const payload = {
        user: {
          name: "alice",
          credentials: {
            password: "secret",
            token: "abc123",
          },
        },
      };

      const result = safePayload(payload);

      expect(result.preview).toContain("alice");
      expect(result.preview).toContain("[REDACTED]");
      expect(result.preview).not.toContain("secret");
      expect(result.preview).not.toContain("abc123");
    });

    it("redacts arrays with sensitive values", () => {
      const payload = {
        tokens: ["token1", "token2"],
        passwords: ["pass1", "pass2"],
      };

      const result = safePayload(payload);

      expect(result.preview).toContain("[REDACTED]");
      expect(result.preview).not.toContain("token1");
      expect(result.preview).not.toContain("pass1");
    });
  });

  describe("currentMode", () => {
    let originalEnv: string | undefined;

    beforeEach(() => {
      originalEnv = process.env.NEXTFORGE_LOG_DATA;
      delete process.env.NEXTFORGE_LOG_DATA;
      setLogDataMode(null as unknown as "off"); // Reset to null
    });

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env.NEXTFORGE_LOG_DATA = originalEnv;
      } else {
        delete process.env.NEXTFORGE_LOG_DATA;
      }
    });

    it("returns summary by default", () => {
      expect(currentMode()).toBe("summary");
    });

    it("reads from NEXTFORGE_LOG_DATA env var", () => {
      process.env.NEXTFORGE_LOG_DATA = "full";
      expect(currentMode()).toBe("full");
    });

    it("prefers explicit mode over env var", () => {
      process.env.NEXTFORGE_LOG_DATA = "full";
      setLogDataMode("off");
      expect(currentMode()).toBe("off");
    });

    it("handles case-insensitive env var", () => {
      process.env.NEXTFORGE_LOG_DATA = "FULL";
      expect(currentMode()).toBe("full");
    });

    it("falls back to summary for invalid env var", () => {
      process.env.NEXTFORGE_LOG_DATA = "invalid";
      expect(currentMode()).toBe("summary");
    });
  });
});
