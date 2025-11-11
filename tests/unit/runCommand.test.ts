import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { runCommand } from "../../src/utils/runCommand.js";
import { setTraceId, getTraceContext, clearStoredSpans } from "../../src/core/tracing.js";

describe("runCommand", () => {
  let originalEnv: NodeJS.ProcessEnv;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let logOutput: string[] = [];

  beforeEach(() => {
    // Save original env
    originalEnv = { ...process.env };

    // Reset exit code
    process.exitCode = 0;

    // Spy on process.stdout.write to capture pino JSON logs
    logOutput = [];
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: any) => {
      const str = chunk.toString();
      logOutput.push(str);
      return true;
    });

    // Also spy on console.log for trace tree output
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logOutput.push(args.join(" "));
    });

    // Clear trace context
    delete process.env.NEXTFORGE_TRACE_ID;
  });

  afterEach(() => {
    // Restore env
    process.env = originalEnv;

    // Restore spies
    stdoutSpy.mockRestore();
    consoleLogSpy.mockRestore();

    // Clear stored spans
    const { traceId } = getTraceContext();
    if (traceId) {
      clearStoredSpans(traceId);
    }
  });

  describe("Failure path summary", () => {
    it("should emit command complete summary with ok=false when command throws", async () => {
      // Force JSON logs for predictable output
      process.env.FORCE_JSON_LOGS = "1";
      process.env.NODE_ENV = "production"; // Don't re-throw in production

      const testError = new Error("Test failure");

      await runCommand(
        "test-fail-command",
        async () => {
          throw testError;
        },
        { silent: false, trace: false }
      );

      // Check that process.exitCode was set (failure)
      expect(process.exitCode).toBeGreaterThan(0);

      // Parse JSON logs
      const jsonLogs = logOutput
        .filter((line) => line.trim().startsWith("{"))
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      // Find the "command complete" log
      const completeSummary = jsonLogs.find((log) => log.msg === "command complete");

      expect(completeSummary).toBeDefined();
      expect(completeSummary?.command).toBe("test-fail-command");
      expect(completeSummary?.ok).toBe(false);
      expect(completeSummary?.errorName).toBe("Error");
      expect(completeSummary?.errorMessage).toBe("Test failure");
      expect(completeSummary?.traceId).toBeTruthy();
      expect(completeSummary?.totalMs).toBeGreaterThanOrEqual(0);
    });

    it("should show trace tree on failure when --trace is enabled", async () => {
      process.env.NODE_ENV = "production"; // Don't re-throw in production

      const testError = new Error("Test failure with trace");

      await runCommand(
        "test-fail-with-trace",
        async ({ profiler }) => {
          profiler.mark("step:setup");
          await new Promise((resolve) => setTimeout(resolve, 10));
          profiler.mark("step:execute");
          throw testError;
        },
        { silent: false, trace: true }
      );

      // Check trace tree was output
      const traceOutput = logOutput.join("\n");
      expect(traceOutput).toContain("Trace:");
      expect(traceOutput).toContain("command:test-fail-with-trace");
    });
  });

  describe("Env override test", () => {
    it("should use NEXTFORGE_TRACE_ID when set", async () => {
      // Force JSON logs for predictable output
      process.env.FORCE_JSON_LOGS = "1";
      process.env.NEXTFORGE_TRACE_ID = "fixed-trace-id";
      process.env.NODE_ENV = "production"; // Don't re-throw

      await runCommand(
        "test-env-trace",
        async () => {
          // Successful command
          return "success";
        },
        { silent: false, trace: false }
      );

      // Parse JSON logs
      const jsonLogs = logOutput
        .filter((line) => line.trim().startsWith("{"))
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      // All logs should have the fixed trace ID
      const logsWithTraceId = jsonLogs.filter((log) => log.traceId);
      expect(logsWithTraceId.length).toBeGreaterThan(0);

      for (const log of logsWithTraceId) {
        expect(log.traceId).toBe("fixed-trace-id");
      }

      // Verify the command complete summary has the fixed trace ID
      const completeSummary = jsonLogs.find((log) => log.msg === "command complete");
      expect(completeSummary?.traceId).toBe("fixed-trace-id");
    });

    it("should include traceId in all log lines via mixin", async () => {
      process.env.FORCE_JSON_LOGS = "1";
      process.env.NEXTFORGE_TRACE_ID = "mixin-test-id";
      process.env.NODE_ENV = "production";

      await runCommand(
        "test-mixin-trace",
        async ({ logger }) => {
          logger.info("test message 1");
          logger.debug("test message 2");
          logger.warn("test message 3");
          return "success";
        },
        { verbose: true, silent: false }
      );

      // Parse JSON logs
      const jsonLogs = logOutput
        .filter((line) => line.trim().startsWith("{"))
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      // Find our test messages
      const testMessages = jsonLogs.filter(
        (log) =>
          log.msg?.includes("test message") ||
          log.msg?.includes("Starting command") ||
          log.msg?.includes("completed successfully") ||
          log.msg === "command complete"
      );

      expect(testMessages.length).toBeGreaterThan(0);

      // Every log should have the trace ID from mixin
      for (const log of testMessages) {
        expect(log.traceId).toBe("mixin-test-id");
      }
    });
  });

  describe("Success path", () => {
    it("should emit command complete summary with ok=true on success", async () => {
      process.env.FORCE_JSON_LOGS = "1";
      process.env.NODE_ENV = "production";

      await runCommand(
        "test-success-command",
        async () => {
          return "success";
        },
        { silent: false, trace: false }
      );

      // Check exit code is 0
      expect(process.exitCode).toBe(0);

      // Parse JSON logs
      const jsonLogs = logOutput
        .filter((line) => line.trim().startsWith("{"))
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      // Find the "command complete" log
      const completeSummary = jsonLogs.find((log) => log.msg === "command complete");

      expect(completeSummary).toBeDefined();
      expect(completeSummary?.command).toBe("test-success-command");
      expect(completeSummary?.ok).toBe(true);
      expect(completeSummary?.errorName).toBeUndefined();
      expect(completeSummary?.errorMessage).toBeUndefined();
      expect(completeSummary?.traceId).toBeTruthy();
      expect(completeSummary?.totalMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Trace ID guarantee", () => {
    it("should always provide a non-empty traceId", async () => {
      process.env.FORCE_JSON_LOGS = "1";
      process.env.NODE_ENV = "production";
      // Don't set NEXTFORGE_TRACE_ID - let it generate one
      delete process.env.NEXTFORGE_TRACE_ID;

      await runCommand(
        "test-auto-trace",
        async ({ logger }) => {
          const { traceId } = getTraceContext();
          logger.info({ traceId }, "checking trace id");
          expect(traceId).toBeTruthy();
          expect(traceId.length).toBeGreaterThan(0);
          return "success";
        },
        { silent: false }
      );

      // Parse JSON logs
      const jsonLogs = logOutput
        .filter((line) => line.trim().startsWith("{"))
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      // Every log should have a non-empty traceId
      for (const log of jsonLogs) {
        if (log.traceId !== undefined) {
          expect(log.traceId).toBeTruthy();
          expect(log.traceId.length).toBeGreaterThan(0);
        }
      }

      // The command complete summary must have a traceId
      const completeSummary = jsonLogs.find((log) => log.msg === "command complete");
      expect(completeSummary?.traceId).toBeTruthy();
      expect(completeSummary?.traceId.length).toBeGreaterThan(0);
    });
  });
});
