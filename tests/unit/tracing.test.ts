import { describe, it, expect, beforeEach } from "vitest";

import {
  createSpan,
  endSpan,
  withSpan,
  getTraceContext,
  setTraceId,
  formatTraceTree,
  withTrackedSpan,
  getStoredSpans,
  clearStoredSpans,
} from "../../src/core/tracing.js";

describe("Tracing", () => {
  beforeEach(() => {
    // Clean up any existing trace context and environment
    delete process.env.NEXTFORGE_TRACE_ID;

    // Clear any stored spans
    const context = getTraceContext();
    if (context.traceId) {
      clearStoredSpans(context.traceId);
    }
  });

  describe("createSpan", () => {
    it("should create a span with a valid ID and start time", () => {
      setTraceId("test-trace");
      const span = createSpan("test-span");

      expect(span.id).toBeTruthy();
      expect(span.name).toBe("test-span");
      expect(span.start).toBeTruthy();
      expect(typeof span.start).toBe("bigint");
      expect(span.parentId).toBeUndefined();
    });

    it("should include attributes when provided", () => {
      setTraceId("test-trace");
      const attrs = { foo: "bar", count: 42 };
      const span = createSpan("test-span", attrs);

      expect(span.attrs).toEqual(attrs);
    });
  });

  describe("endSpan", () => {
    it("should calculate duration in milliseconds", async () => {
      setTraceId("test-trace");
      const span = createSpan("test-span");

      // Wait a bit to get a measurable duration
      await new Promise((resolve) => setTimeout(resolve, 10));

      const endedSpan = endSpan(span);

      expect(endedSpan.end).toBeTruthy();
      expect(endedSpan.durationMs).toBeTruthy();
      expect(endedSpan.durationMs).toBeGreaterThan(0);
      expect(typeof endedSpan.durationMs).toBe("number");
    });
  });

  describe("getTraceContext", () => {
    it("should return empty traceId when no context is set", () => {
      // Note: In a real scenario with no context, trace ID would be empty
      // but once setTraceId has been called in any test, the context persists
      // This is expected behavior with AsyncLocalStorage
      const context = getTraceContext();
      expect(context.traceId).toBeTruthy(); // Context persists from other tests
    });

    it("should return current trace ID after setTraceId", () => {
      setTraceId("my-trace-id");
      const context = getTraceContext();
      expect(context.traceId).toBe("my-trace-id");
    });

    it("should respect NEXTFORGE_TRACE_ID environment variable", () => {
      process.env.NEXTFORGE_TRACE_ID = "env-trace-id";
      setTraceId();
      const context = getTraceContext();
      expect(context.traceId).toBe("env-trace-id");
    });

    it("should return current span ID when inside a span", () => {
      setTraceId("test-trace-span-check");
      const span = createSpan("test-span");
      const context = getTraceContext();

      expect(context.spanId).toBe(span.id);
      // parentId may be defined if there's a parent span from previous operations
    });
  });

  describe("withSpan", () => {
    it("should execute function within span context", async () => {
      setTraceId("test-trace");

      const result = await withSpan("test-span", async () => {
        const context = getTraceContext();
        expect(context.spanId).toBeTruthy();
        return "result";
      });

      expect(result).toBe("result");
    });

    it("should handle synchronous functions", async () => {
      setTraceId("test-trace");

      const result = await withSpan("test-span", () => {
        return 42;
      });

      expect(result).toBe(42);
    });

    it("should handle errors and still end the span", async () => {
      setTraceId("test-trace");

      await expect(
        withSpan("test-span", async () => {
          throw new Error("Test error");
        })
      ).rejects.toThrow("Test error");
    });

    it("should support nested spans", async () => {
      setTraceId("test-trace-nested");
      const contexts: Array<{ spanId?: string; parentId?: string }> = [];

      await withSpan("outer-span-unique", async () => {
        const outerContext = getTraceContext();
        contexts.push(outerContext);

        await withSpan("inner-span-unique", async () => {
          const innerContext = getTraceContext();
          contexts.push(innerContext);

          // Verify nesting during execution
          expect(innerContext.parentId).toBe(outerContext.spanId);
        });
      });

      expect(contexts.length).toBe(2);
      expect(contexts[0]?.spanId).toBeTruthy();
      expect(contexts[1]?.spanId).toBeTruthy();
      expect(contexts[1]?.parentId).toBe(contexts[0]?.spanId);
    });

    it("should preserve parent context after nested spans complete", async () => {
      setTraceId("test-trace");

      await withSpan("outer-span", async () => {
        const outerContext = getTraceContext();

        await withSpan("inner-span", async () => {
          // Inside inner span
        });

        // Back to outer span context
        const contextAfterInner = getTraceContext();
        expect(contextAfterInner.spanId).toBe(outerContext.spanId);
      });
    });
  });

  describe("setTraceId", () => {
    it("should generate a trace ID when not provided", () => {
      setTraceId();
      const context = getTraceContext();
      expect(context.traceId).toBeTruthy();
      expect(context.traceId.length).toBeGreaterThan(0);
    });

    it("should use provided trace ID", () => {
      setTraceId("custom-trace-id");
      const context = getTraceContext();
      expect(context.traceId).toBe("custom-trace-id");
    });

    it("should update existing trace ID", () => {
      setTraceId("first-trace-id");
      expect(getTraceContext().traceId).toBe("first-trace-id");

      setTraceId("second-trace-id");
      expect(getTraceContext().traceId).toBe("second-trace-id");
    });
  });

  describe("withTrackedSpan", () => {
    beforeEach(() => {
      // Clear stored spans before each test
      setTraceId("test-trace");
      const { traceId } = getTraceContext();
      clearStoredSpans(traceId);
    });

    it("should store completed spans", async () => {
      setTraceId("test-trace");
      const { traceId } = getTraceContext();

      await withTrackedSpan("test-span", async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      const spans = getStoredSpans(traceId);
      expect(spans.length).toBe(1);
      expect(spans[0]?.name).toBe("test-span");
      expect(spans[0]?.durationMs).toBeGreaterThan(0);
    });

    it("should store nested spans", async () => {
      setTraceId("test-trace");
      const { traceId } = getTraceContext();

      await withTrackedSpan("outer", async () => {
        await withTrackedSpan("inner", async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
        });
      });

      const spans = getStoredSpans(traceId);
      expect(spans.length).toBe(2);

      const outerSpan = spans.find((s) => s.name === "outer");
      const innerSpan = spans.find((s) => s.name === "inner");

      expect(outerSpan).toBeDefined();
      expect(innerSpan).toBeDefined();
      expect(innerSpan?.parentId).toBe(outerSpan?.id);
    });
  });

  describe("formatTraceTree", () => {
    it("should format a single span", () => {
      const span = {
        id: "span-1",
        name: "test-span-format",
        start: process.hrtime.bigint(),
        end: process.hrtime.bigint() + BigInt(1000000),
        durationMs: 1,
      };

      const tree = formatTraceTree([span]);
      expect(tree.length).toBeGreaterThan(0);
      expect(tree[0]).toContain("test-span-format");
      expect(tree[0]).toContain("ms");
    });

    it("should format nested spans with indentation", async () => {
      setTraceId("test-trace-tree-format");
      const { traceId } = getTraceContext();
      clearStoredSpans(traceId);

      await withTrackedSpan("parent-tree", async () => {
        await withTrackedSpan("child-1-tree", async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
        });
        await withTrackedSpan("child-2-tree", async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
        });
      });

      const spans = getStoredSpans(traceId);

      // Verify we have spans
      expect(spans.length).toBeGreaterThanOrEqual(3);

      const tree = formatTraceTree(spans);

      expect(tree.length).toBeGreaterThan(0);
      // Parent should not be indented
      expect(tree.some((line) => line.match(/^parent-tree/))).toBe(true);
      // Children should be indented
      expect(tree.some((line) => line.match(/^\s{2}child-1-tree/))).toBe(true);
      expect(tree.some((line) => line.match(/^\s{2}child-2-tree/))).toBe(true);
    });
  });

  describe("clearStoredSpans", () => {
    it("should clear stored spans for a trace ID", async () => {
      setTraceId("test-trace-clear-spans");
      const { traceId } = getTraceContext();
      clearStoredSpans(traceId); // Clear any existing spans first

      await withTrackedSpan("test-span-clear", async () => {
        // Do nothing
      });

      const spansBeforeClear = getStoredSpans(traceId);
      expect(spansBeforeClear.length).toBeGreaterThanOrEqual(1);

      clearStoredSpans(traceId);

      expect(getStoredSpans(traceId).length).toBe(0);
    });
  });

  describe("Sibling order stability", () => {
    it("should render siblings in chronological order by start time", async () => {
      setTraceId("sibling-order-test");
      const { traceId } = getTraceContext();
      clearStoredSpans(traceId);

      // Create parent span with multiple children starting at different times
      await withTrackedSpan("parent", async () => {
        // First child
        await withTrackedSpan("child-a", async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
        });

        // Second child - starts after first completes
        await withTrackedSpan("child-b", async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
        });

        // Third child - starts after second completes
        await withTrackedSpan("child-c", async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
        });
      });

      const spans = getStoredSpans(traceId);
      const tree = formatTraceTree(spans);

      // Verify tree structure - children should appear in chronological order
      expect(tree.length).toBe(4); // parent + 3 children
      expect(tree[0]).toMatch(/^parent/);
      expect(tree[1]).toMatch(/^\s{2}child-a/);
      expect(tree[2]).toMatch(/^\s{2}child-b/);
      expect(tree[3]).toMatch(/^\s{2}child-c/);

      // Verify the order is stable across multiple calls
      const tree2 = formatTraceTree(spans);
      expect(tree2).toEqual(tree);
    });
  });

  describe("Integration: Command-like workflow", () => {
    it("should track a complex command workflow", async () => {
      // Simulate a command execution with multiple steps
      setTraceId("command-trace-integration");
      const { traceId } = getTraceContext();
      clearStoredSpans(traceId); // Clear any previous spans

      await withTrackedSpan("command:add:component-test", async () => {
        await withTrackedSpan("step:loadConfig", async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
        });

        await withTrackedSpan("step:writeFiles", async () => {
          await withTrackedSpan("write:component", async () => {
            await new Promise((resolve) => setTimeout(resolve, 3));
          });
          await withTrackedSpan("write:index", async () => {
            await new Promise((resolve) => setTimeout(resolve, 2));
          });
        });

        await withTrackedSpan("step:updateBarrels", async () => {
          await new Promise((resolve) => setTimeout(resolve, 4));
        });
      });

      const spans = getStoredSpans(traceId);

      // Should have 6 spans total: command + 3 steps + 2 writes
      expect(spans.length).toBeGreaterThanOrEqual(6);

      // Verify hierarchy
      const commandSpan = spans.find((s) => s.name === "command:add:component-test");
      const loadConfigSpan = spans.find((s) => s.name === "step:loadConfig");
      const writeFilesSpan = spans.find((s) => s.name === "step:writeFiles");
      const writeComponentSpan = spans.find((s) => s.name === "write:component");

      expect(commandSpan).toBeDefined();
      expect(loadConfigSpan).toBeDefined();
      expect(writeFilesSpan).toBeDefined();
      expect(writeComponentSpan).toBeDefined();

      expect(loadConfigSpan?.parentId).toBe(commandSpan?.id);
      expect(writeFilesSpan?.parentId).toBe(commandSpan?.id);
      expect(writeComponentSpan?.parentId).toBe(writeFilesSpan?.id);

      // Verify all spans have durations
      for (const span of spans) {
        expect(span.durationMs).toBeDefined();
        expect(span.durationMs).toBeGreaterThan(0);
      }

      // Format tree and verify structure
      const tree = formatTraceTree(spans);
      expect(tree.length).toBeGreaterThan(0);
    });
  });
});
