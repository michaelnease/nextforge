/**
 * Distributed tracing implementation using AsyncLocalStorage
 * Provides trace and span context for correlating logs and measuring durations
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export interface Span {
  id: string;
  parentId?: string | undefined;
  name: string;
  start: bigint;
  end?: bigint | undefined;
  durationMs?: number | undefined;
  attrs?: Record<string, unknown> | undefined;
}

export interface TraceContext {
  traceId: string;
  spanStack: Span[];
}

// AsyncLocalStorage instance to hold trace context
const asyncLocalStorage = new AsyncLocalStorage<TraceContext>();

/**
 * Get the current trace context from AsyncLocalStorage
 * Lazily creates a trace context if one doesn't exist
 */
export function getTraceContext(): {
  traceId: string;
  spanId?: string | undefined;
  parentId?: string | undefined;
} {
  let context = asyncLocalStorage.getStore();

  // Lazily create trace context if it doesn't exist
  if (!context) {
    setTraceId();
    context = asyncLocalStorage.getStore();
    if (!context) {
      // Fallback - should never happen but prevents empty traceId
      return { traceId: process.env.NEXTFORGE_TRACE_ID || randomUUID() };
    }
  }

  const currentSpan = context.spanStack[context.spanStack.length - 1];
  return {
    traceId: context.traceId,
    spanId: currentSpan?.id ?? undefined,
    parentId: currentSpan?.parentId ?? undefined,
  };
}

/**
 * Set or override the trace ID for the current context
 * If called within an existing trace context, updates the traceId and clears the span stack
 * Otherwise, creates a new context
 */
export function setTraceId(traceId?: string): void {
  const id = traceId || process.env.NEXTFORGE_TRACE_ID || randomUUID();
  const existingContext = asyncLocalStorage.getStore();

  if (existingContext) {
    // Update existing context and clear span stack for new trace
    existingContext.traceId = id;
    existingContext.spanStack = [];
  } else {
    // Create new context
    const newContext: TraceContext = {
      traceId: id,
      spanStack: [],
    };
    asyncLocalStorage.enterWith(newContext);
  }
}

/**
 * Create and start a new span
 * Returns the span object which should be ended manually
 */
export function createSpan(name: string, attrs?: Record<string, unknown>): Span {
  const context = asyncLocalStorage.getStore();
  if (!context) {
    // No active trace context - create one
    setTraceId();
    return createSpan(name, attrs);
  }

  const parentSpan = context.spanStack[context.spanStack.length - 1];
  const span: Span = {
    id: randomUUID().split("-")[0] || randomUUID().substring(0, 8), // Short ID
    parentId: parentSpan?.id ?? undefined,
    name,
    start: process.hrtime.bigint(),
    attrs,
  };

  context.spanStack.push(span);
  return span;
}

/**
 * End a span and calculate its duration
 */
export function endSpan(span: Span): Span {
  const context = asyncLocalStorage.getStore();
  if (!context) {
    return span;
  }

  // Find and remove span from stack
  const index = context.spanStack.findIndex((s) => s.id === span.id);
  if (index !== -1) {
    context.spanStack.splice(index, 1);
  }

  // Calculate duration
  span.end = process.hrtime.bigint();
  span.durationMs = Number(span.end - span.start) / 1_000_000; // Convert nanoseconds to milliseconds

  return span;
}

/**
 * Execute a function within a span context
 * Automatically creates, manages, and ends the span
 */
export async function withSpan<T>(
  name: string,
  fn: () => Promise<T> | T,
  attrs?: Record<string, unknown>
): Promise<T> {
  const span = createSpan(name, attrs);

  try {
    const result = await fn();
    return result;
  } finally {
    endSpan(span);
  }
}

/**
 * Get all completed spans for the current trace
 * Useful for generating trace summaries
 */
export function getCompletedSpans(): Span[] {
  const context = asyncLocalStorage.getStore();
  if (!context) {
    return [];
  }

  // Return only completed spans (those with end time)
  return context.spanStack.filter((s) => s.end !== undefined);
}

/**
 * Format trace tree for human-readable output
 * Shows nested spans with durations
 */
export function formatTraceTree(spans: Span[], indent = 0): string[] {
  const lines: string[] = [];

  // Group spans by parent
  const rootSpans = spans.filter((s) => !s.parentId);
  const childSpansByParent = new Map<string, Span[]>();

  for (const span of spans) {
    if (span.parentId) {
      const children = childSpansByParent.get(span.parentId) || [];
      children.push(span);
      childSpansByParent.set(span.parentId, children);
    }
  }

  // Build tree recursively
  function addSpan(span: Span, depth: number) {
    const prefix = "  ".repeat(depth);
    const duration = span.durationMs?.toFixed(2) || "?";
    lines.push(`${prefix}${span.name} (${duration} ms)`);

    // Add children
    const children = childSpansByParent.get(span.id) || [];
    for (const child of children) {
      addSpan(child, depth + 1);
    }
  }

  for (const rootSpan of rootSpans) {
    addSpan(rootSpan, indent);
  }

  return lines;
}

/**
 * Store completed spans for later retrieval
 * This is needed because spans are removed from the stack when ended
 */
const completedSpansStore = new Map<string, Span[]>();

/**
 * Store a completed span for later retrieval
 */
export function storeCompletedSpan(span: Span): void {
  const context = asyncLocalStorage.getStore();
  if (!context) {
    return;
  }

  const spans = completedSpansStore.get(context.traceId) || [];
  spans.push(span);
  completedSpansStore.set(context.traceId, spans);
}

/**
 * Get stored completed spans for a trace ID
 */
export function getStoredSpans(traceId: string): Span[] {
  return completedSpansStore.get(traceId) || [];
}

/**
 * Clear stored spans for a trace ID
 */
export function clearStoredSpans(traceId: string): void {
  completedSpansStore.delete(traceId);
}

/**
 * Enhanced withSpan that stores completed spans
 */
export async function withTrackedSpan<T>(
  name: string,
  fn: () => Promise<T> | T,
  attrs?: Record<string, unknown>
): Promise<T> {
  const span = createSpan(name, attrs);

  try {
    const result = await fn();
    return result;
  } finally {
    const completedSpan = endSpan(span);
    storeCompletedSpan(completedSpan);
  }
}
