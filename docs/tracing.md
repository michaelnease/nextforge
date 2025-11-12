# Distributed Tracing

NextForge includes built-in distributed tracing to help correlate logs, measure durations, and understand the flow of command execution.

## Overview

Tracing provides:

- **Trace IDs** to correlate all logs from a single command execution
- **Span IDs** to track individual operations within a command
- **Duration measurements** for performance analysis
- **Hierarchical span relationships** to understand operation nesting
- **Human-readable trace trees** for debugging

## Quick Start

### Viewing Traces

Add the `--trace` flag to any command to see a human-readable trace tree:

```bash
npx nextforge doctor --trace
```

Output includes the trace tree after JSON logs:

```
Trace:
command:doctor (7.29 ms)
```

For more complex commands with multiple operations:

```bash
npx nextforge add:component Button --trace
```

Output:

```
Trace:
command:add:component (45.2 ms)
  step:loadConfig (12.3 ms)
  step:writeFiles (28.1 ms)
    write:Button.tsx (15.4 ms)
    write:index.ts (8.2 ms)
  step:updateBarrels (4.8 ms)
```

### Custom Trace IDs

Set a custom trace ID using the `NEXTFORGE_TRACE_ID` environment variable:

```bash
export NEXTFORGE_TRACE_ID=my-debug-session
npx nextforge add:page Home --trace
```

This is useful for:

- Debugging specific issues across multiple command invocations
- Correlating logs in CI/CD pipelines
- Distributed tracing across services

## Log Integration

All JSON logs automatically include `traceId` and `spanId` fields:

```json
{
  "level": 30,
  "time": "2025-11-07T17:48:50.363Z",
  "version": "0.1.0",
  "cmd": "doctor",
  "runId": "8f09d00b-1af4-4ef8-ade4-12b1168166e6",
  "traceId": "c204740a-d4d5-4f69-8915-11d00e6f3d90",
  "spanId": "a1b2c3d4",
  "event": "start",
  "msg": "Starting command: doctor"
}
```

### Final Summary Log

Every command execution emits a final summary log:

```json
{
  "level": 30,
  "msg": "command complete",
  "command": "doctor",
  "totalMs": 7,
  "traceId": "c204740a-d4d5-4f69-8915-11d00e6f3d90",
  "exitCode": 0
}
```

This log is emitted even on failure, with the appropriate `exitCode`.

## Command Options

All commands support these tracing-related options:

- `--trace`: Output human-readable trace tree after JSON logs
- `--profile`: Enable detailed performance profiling (includes CPU, memory, I/O)
- `--metrics json`: Output performance metrics as JSON only
- `--verbose`: Enable verbose logging (includes debug-level logs)

## Examples

### Debugging Slow Commands

```bash
# See which operations take the most time
npx nextforge add:group auth --pages signin,signup --trace --profile
```

Output shows both the trace tree and performance profile:

```
Trace:
command:add:group (123.5 ms)
  step:validateInput (2.1 ms)
  step:resolveAppRoot (5.3 ms)
  step:createGroupDirectory (8.7 ms)
  step:writePages (95.2 ms)
    write:signin/page.tsx (45.1 ms)
    write:signup/page.tsx (48.3 ms)
  step:updateManifest (12.2 ms)

Performance Profile:
Command: add:group
Duration: 123.5ms
CPU: 78.2ms user, 12.3ms system
Memory: 64.2MB start → 68.5MB peak
I/O: 4 writes (1.2KB)
```

### CI/CD Integration

```bash
# Use fixed trace ID for log correlation
export NEXTFORGE_TRACE_ID=$CI_BUILD_ID
npx nextforge doctor --json

# Extract trace ID from logs
TRACE_ID=$(cat .nextforge/logs/$(date +%Y-%m-%d).log | jq -r '.traceId' | head -1)
echo "Trace ID: $TRACE_ID"
```

### Multiple Commands with Same Trace

```bash
# Share trace ID across multiple commands
export NEXTFORGE_TRACE_ID=my-feature-dev
npx nextforge add:page Home
npx nextforge add:component Header
npx nextforge add:component Footer

# All logs will have the same traceId for correlation
grep $NEXTFORGE_TRACE_ID .nextforge/logs/$(date +%Y-%m-%d).log
```

## Programmatic API

If you're building tools that use NextForge, you can use the tracing API directly:

```typescript
import {
  setTraceId,
  getTraceContext,
  withTrackedSpan,
  getStoredSpans,
  formatTraceTree,
} from "@forgefoundry/nextforge/core/tracing";

// Set custom trace ID
setTraceId("my-custom-trace");

// Execute operation within a span
await withTrackedSpan("my-operation", async () => {
  // Your code here
  // All logs will automatically include spanId
});

// Get current trace context
const { traceId, spanId, parentId } = getTraceContext();

// Get and format completed spans
const spans = getStoredSpans(traceId);
const tree = formatTraceTree(spans);
console.log(tree.join("\n"));
```

## Architecture

### AsyncLocalStorage

Tracing uses Node.js `AsyncLocalStorage` to maintain trace context across async operations without explicit context passing. This ensures:

- Automatic context propagation through async/await chains
- No manual context threading required
- Works with promises, callbacks, and async iterators

### Span Lifecycle

1. **Create**: Span created with `createSpan()` or `withSpan()`
2. **Push**: Added to the span stack in AsyncLocalStorage
3. **Execute**: Operation runs with span context
4. **End**: Span ended, duration calculated
5. **Pop**: Removed from stack
6. **Store**: Added to completed spans map for later retrieval

### Log Injection

A Pino mixin injects trace context into every log entry:

```typescript
mixin: () => {
  const { traceId, spanId } = getTraceContext();
  return { traceId, spanId };
};
```

## Performance Considerations

- **Low Overhead**: Span creation adds ~0.01ms per span
- **Memory Efficient**: Spans cleared after command completion
- **Non-Blocking**: AsyncLocalStorage is O(1) for context retrieval
- **Optional**: Tracing has no performance impact unless `--trace` is used

## Best Practices

1. **Use Custom Trace IDs for Debugging**: Set `NEXTFORGE_TRACE_ID` when debugging specific issues
2. **Combine with --profile**: Use `--trace --profile` together for comprehensive analysis
3. **Filter Logs by Trace ID**: Use `jq` to filter JSON logs by traceId
4. **Archive Traces**: Keep trace logs for post-mortem analysis
5. **Document Trace IDs**: Include trace IDs in bug reports and support requests

## Troubleshooting

### No Trace Output

If `--trace` shows no output, check:

- Command completed successfully (traces only show for completed commands)
- JSON logging is not enabled (`--json` disables trace output)
- Metrics mode is not enabled (`--metrics json` disables trace output)

### Missing Trace IDs in Logs

Trace IDs should appear in all logs after a command starts. If missing:

- Check that the command uses `runCommand` wrapper
- Verify AsyncLocalStorage context is available
- Ensure logger is created with the mixin

### Incorrect Nesting in Trace Tree

If span nesting looks wrong:

- Verify spans are properly nested with `withTrackedSpan`
- Check that parent spans complete after children
- Ensure AsyncLocalStorage context isn't lost across async boundaries

## Related

- [Logging Data](./LOGGING_DATA.md) - Structured logging and data introspection
