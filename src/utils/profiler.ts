import { performance, PerformanceObserver, monitorEventLoopDelay } from "node:perf_hooks";

interface ResourceUsage {
  userCPUTime: number; // microseconds
  systemCPUTime: number; // microseconds
}

interface MemorySnapshot {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
}

interface GCEvent {
  type: string;
  durationMs: number;
}

interface StepTiming {
  name: string;
  startMs: number;
  endMs?: number;
  durationMs?: number;
}

export interface ProfileSummary {
  cmd: string;
  ok: boolean;
  wallMs: number;
  cpu: {
    userMs: number;
    systemMs: number;
  };
  memory: {
    startMB: number;
    peakMB: number;
    endMB: number;
  };
  eventLoop?: {
    p50: number;
    p90: number;
    p99: number;
    max: number;
  };
  io: {
    reads: number;
    writes: number;
    bytesRead: number;
    bytesWritten: number;
  };
  gc: GCEvent[];
  steps?: StepTiming[];
}

/**
 * Performance profiler for CLI commands
 * Tracks wall time, CPU, memory, event loop, GC, and I/O
 */
export class Profiler {
  private commandName: string;
  private startTime: number;
  private endTime?: number;
  private startCpu?: ResourceUsage;
  private endCpu?: ResourceUsage;
  private startMem: MemorySnapshot;
  private endMem?: MemorySnapshot;
  private peakMem: MemorySnapshot;
  private gcEvents: GCEvent[] = [];
  private ioReads = 0;
  private ioWrites = 0;
  private ioBytesRead = 0;
  private ioBytesWritten = 0;
  private steps: StepTiming[] = [];
  private eventLoopMonitor?: ReturnType<typeof monitorEventLoopDelay>;
  private gcObserver?: PerformanceObserver;
  private profilingEnabled: boolean;

  constructor(commandName: string, enableProfiling = false) {
    this.commandName = commandName;
    this.profilingEnabled = enableProfiling;
    this.startTime = performance.now();
    this.startMem = this.captureMemory();
    this.peakMem = { ...this.startMem };

    // Capture CPU usage at start
    try {
      this.startCpu = process.resourceUsage();
    } catch {
      // resourceUsage may not be available in all Node versions
    }

    if (this.profilingEnabled) {
      this.initEventLoopMonitor();
      this.initGCObserver();
    }
  }

  /**
   * Initialize event loop delay monitoring
   */
  private initEventLoopMonitor(): void {
    try {
      this.eventLoopMonitor = monitorEventLoopDelay({ resolution: 10 });
      this.eventLoopMonitor.enable();
    } catch (err) {
      // Event loop monitoring not available
    }
  }

  /**
   * Initialize GC observer
   */
  private initGCObserver(): void {
    try {
      this.gcObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          if (entry.entryType === "gc") {
            this.gcEvents.push({
              type: this.getGCType(
                (entry as PerformanceEntry & { detail?: { kind?: number } }).detail?.kind
              ),
              durationMs: entry.duration,
            });
          }
        }
      });
      this.gcObserver.observe({ entryTypes: ["gc"] });
    } catch (err) {
      // GC observer not available
    }
  }

  /**
   * Map GC kind to human-readable type
   */
  private getGCType(kind?: number): string {
    switch (kind) {
      case 1:
        return "scavenge";
      case 2:
        return "mark-sweep-compact";
      case 4:
        return "incremental";
      case 8:
        return "weak-callbacks";
      case 15:
        return "all";
      default:
        return "unknown";
    }
  }

  /**
   * Capture current memory snapshot
   */
  private captureMemory(): MemorySnapshot {
    const mem = process.memoryUsage();
    return {
      rss: mem.rss,
      heapTotal: mem.heapTotal,
      heapUsed: mem.heapUsed,
      external: mem.external,
    };
  }

  /**
   * Record a named step
   */
  step(name: string): { end: () => void } {
    const step: StepTiming = {
      name,
      startMs: performance.now() - this.startTime,
    };
    this.steps.push(step);

    return {
      end: () => {
        step.endMs = performance.now() - this.startTime;
        step.durationMs = step.endMs - step.startMs;
      },
    };
  }

  /**
   * Record a file read
   */
  bumpRead(bytes: number): void {
    this.ioReads++;
    this.ioBytesRead += bytes;
  }

  /**
   * Record a file write
   */
  bumpWrite(bytes: number): void {
    this.ioWrites++;
    this.ioBytesWritten += bytes;
  }

  /**
   * Sample and update peak memory
   */
  sampleMemPeak(): void {
    const current = this.captureMemory();
    if (current.rss > this.peakMem.rss) {
      this.peakMem = current;
    }
  }

  /**
   * Finish profiling and return summary
   */
  finish(ok: boolean, _err?: unknown): ProfileSummary {
    this.endTime = performance.now();
    this.endMem = this.captureMemory();

    // Capture CPU usage at end
    try {
      this.endCpu = process.resourceUsage();
    } catch {
      // resourceUsage may not be available
    }

    // Clean up monitors
    if (this.eventLoopMonitor) {
      this.eventLoopMonitor.disable();
    }
    if (this.gcObserver) {
      this.gcObserver.disconnect();
    }

    // Calculate CPU times
    const cpuUser =
      this.startCpu && this.endCpu
        ? (this.endCpu.userCPUTime - this.startCpu.userCPUTime) / 1000
        : 0;
    const cpuSystem =
      this.startCpu && this.endCpu
        ? (this.endCpu.systemCPUTime - this.startCpu.systemCPUTime) / 1000
        : 0;

    // Get event loop percentiles
    let eventLoop: ProfileSummary["eventLoop"];
    if (this.eventLoopMonitor) {
      const percentiles = this.eventLoopMonitor.percentiles;
      const p50 = percentiles.get(50);
      const p90 = percentiles.get(90);
      const p99 = percentiles.get(99);

      if (p50 !== undefined && p90 !== undefined && p99 !== undefined) {
        eventLoop = {
          p50: p50 / 1e6, // Convert nanoseconds to milliseconds
          p90: p90 / 1e6,
          p99: p99 / 1e6,
          max: this.eventLoopMonitor.max / 1e6,
        };
      }
    }

    const endMemToUse = this.endMem || this.startMem;

    const summary: ProfileSummary = {
      cmd: this.commandName,
      ok,
      wallMs: Number((this.endTime - this.startTime).toFixed(2)),
      cpu: {
        userMs: Number(cpuUser.toFixed(2)),
        systemMs: Number(cpuSystem.toFixed(2)),
      },
      memory: {
        startMB: Number((this.startMem.rss / 1024 / 1024).toFixed(2)),
        peakMB: Number((this.peakMem.rss / 1024 / 1024).toFixed(2)),
        endMB: Number((endMemToUse.rss / 1024 / 1024).toFixed(2)),
      },
      io: {
        reads: this.ioReads,
        writes: this.ioWrites,
        bytesRead: this.ioBytesRead,
        bytesWritten: this.ioBytesWritten,
      },
      gc: this.gcEvents.map((e) => ({
        type: e.type,
        durationMs: Number(e.durationMs.toFixed(2)),
      })),
    };

    // Include event loop stats if profiling was enabled
    if (eventLoop) {
      summary.eventLoop = eventLoop;
    }

    // Include steps if any were recorded
    if (this.steps.length > 0) {
      summary.steps = this.steps.map((s) => {
        const step: StepTiming = {
          name: s.name,
          startMs: Number(s.startMs.toFixed(2)),
        };
        if (s.endMs !== undefined) {
          step.endMs = Number(s.endMs.toFixed(2));
        }
        if (s.durationMs !== undefined) {
          step.durationMs = Number(s.durationMs.toFixed(2));
        }
        return step;
      });
    }

    return summary;
  }
}

/**
 * Format profile summary for human-readable console output
 */
export function formatProfileSummary(profile: ProfileSummary): string {
  const lines: string[] = [];

  lines.push(
    `wall=${profile.wallMs}ms  cpuUser=${profile.cpu.userMs}ms  cpuSys=${profile.cpu.systemMs}ms`
  );
  lines.push(
    `memStart=${profile.memory.startMB} MB → peak ${profile.memory.peakMB} MB → end ${profile.memory.endMB} MB`
  );

  if (profile.eventLoop) {
    lines.push(
      `eventLoop p50=${profile.eventLoop.p50.toFixed(1)} ms p90=${profile.eventLoop.p90.toFixed(1)} ms p99=${profile.eventLoop.p99.toFixed(1)} ms max=${profile.eventLoop.max.toFixed(1)} ms`
    );
  }

  const bytesToKB = (bytes: number) => (bytes / 1024).toFixed(1);
  lines.push(
    `io reads=${profile.io.reads} writes=${profile.io.writes} bytesRead=${bytesToKB(profile.io.bytesRead)} KB bytesWritten=${bytesToKB(profile.io.bytesWritten)} B`
  );

  if (profile.gc.length > 0) {
    const totalGcMs = profile.gc.reduce((sum, gc) => sum + gc.durationMs, 0);
    const gcByType = profile.gc.reduce(
      (acc, gc) => {
        acc[gc.type] = (acc[gc.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    const gcSummary = Object.entries(gcByType)
      .map(([type, count]) => `${type}=${count}`)
      .join(" ");
    lines.push(`gc ${gcSummary} total=${totalGcMs.toFixed(1)} ms`);
  }

  return lines.join("\n");
}
