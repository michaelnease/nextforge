/**
 * Safe data introspection utilities for logging payloads without leaking secrets
 */

import crypto from "node:crypto";

import type { Logger } from "pino";

import { redactValue } from "./regexes.js";

export type LogDataMode = "off" | "summary" | "full";

// Global state
let currentLogDataMode: LogDataMode | null = null;
let extraRedactKeys: string[] = [];

/**
 * Get current logging mode from flags, env, or config
 */
export function currentMode(): LogDataMode {
  // Return cached if already determined
  if (currentLogDataMode !== null) {
    return currentLogDataMode;
  }

  // Check environment variable
  const envMode = process.env.NEXTFORGE_LOG_DATA?.toLowerCase();
  if (envMode === "off" || envMode === "summary" || envMode === "full") {
    return envMode;
  }

  // Default to summary
  return "summary";
}

/**
 * Set the current log data mode (typically called from CLI flag processing)
 */
export function setLogDataMode(mode: LogDataMode): void {
  currentLogDataMode = mode;
}

/**
 * Set additional keys to redact beyond the default list
 */
export function setExtraRedactKeys(keys: string[]): void {
  extraRedactKeys = keys;
}

/**
 * Get extra redact keys
 */
export function getExtraRedactKeys(): string[] {
  return extraRedactKeys;
}

/**
 * Circular-safe stringify with stable key ordering
 */
function stableStringify(obj: unknown): string {
  const seen = new WeakSet();

  return JSON.stringify(
    obj,
    (_key, value) => {
      // Handle circular references
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) {
          return "[Circular]";
        }
        seen.add(value);
      }

      // Sort object keys for stability
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return Object.keys(value)
          .sort()
          .reduce(
            (sorted, k) => {
              sorted[k] = value[k];
              return sorted;
            },
            {} as Record<string, unknown>
          );
      }

      return value;
    },
    2
  );
}

/**
 * Redact sensitive data from a payload
 */
function redactPayload(
  payload: unknown,
  noRedact = false,
  seen: WeakSet<object> = new WeakSet()
): unknown {
  if (noRedact) {
    return payload;
  }

  if (payload === null || payload === undefined) {
    return payload;
  }

  // Handle circular references
  if (typeof payload === "object" && payload !== null) {
    if (seen.has(payload)) {
      return "[Circular]";
    }
    seen.add(payload);
  }

  // Handle arrays
  if (Array.isArray(payload)) {
    return payload.map((item) => redactPayload(item, noRedact, seen));
  }

  // Handle objects
  if (typeof payload === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      const redacted = redactValue(value, key, extraRedactKeys);
      if (redacted === "[REDACTED]") {
        result[key] = redacted;
      } else {
        result[key] = redactPayload(value, noRedact, seen);
      }
    }
    return result;
  }

  // For primitives, check if value itself is sensitive
  const redacted = redactValue(payload, undefined, extraRedactKeys);
  return redacted;
}

/**
 * Truncate a string to a maximum byte length
 */
function truncateString(str: string, maxBytes: number): string {
  const bytes = Buffer.byteLength(str, "utf8");
  if (bytes <= maxBytes) {
    return str;
  }

  // Truncate and add overflow marker
  let truncated = str;
  while (Buffer.byteLength(truncated, "utf8") > maxBytes - 20) {
    truncated = truncated.slice(0, -1);
  }

  return truncated + `\n... (${bytes - Buffer.byteLength(truncated, "utf8")} more bytes)`;
}

/**
 * Compute SHA256 hash of content
 */
function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex").substring(0, 16);
}

/**
 * Create a safe payload summary with redaction, truncation, and hashing
 */
export function safePayload(
  payload: unknown,
  opts?: {
    maxPreviewBytes?: number;
    noRedact?: boolean;
  }
): {
  bytes: number;
  hash: string;
  preview: string;
} {
  const { maxPreviewBytes = 512, noRedact = false } = opts || {};

  // Redact sensitive data
  const redacted = redactPayload(payload, noRedact);

  // Stringify
  const jsonString = stableStringify(redacted);

  // Calculate byte count
  const bytes = Buffer.byteLength(jsonString, "utf8");

  // Compute hash of original (redacted) content
  const hash = hashContent(jsonString);

  // Truncate for preview
  const preview = truncateString(jsonString, maxPreviewBytes);

  return {
    bytes,
    hash,
    preview,
  };
}

/**
 * Check if a path or label refers to a text-like file
 */
export function isTextLike(pathOrLabel: string): boolean {
  return /\.(ts|tsx|js|jsx|json|md|css|scss|html|yml|yaml|txt|mjs|cjs)$/i.test(pathOrLabel);
}

/**
 * Build a safe preview object for file content
 * Returns { bytes, hash, preview } respecting current mode
 */
export function buildPreview(
  content: string,
  opts?: { noRedact?: boolean }
): { bytes: number; hash: string; preview: string } {
  const mode = currentMode();
  const maxBytes = mode === "full" ? 4096 : 512;
  const noRedact = opts?.noRedact ?? process.env.NEXTFORGE_NO_REDACT === "1";

  return safePayload(content, { maxPreviewBytes: maxBytes, noRedact });
}

/**
 * Log data safely based on current mode
 */
export function logData(logger: Logger, label: string, payload: unknown): void {
  const mode = currentMode();

  // Performance: short-circuit early when mode is off
  if (mode === "off") {
    return;
  }

  const maxBytes = mode === "full" ? 4096 : 512;
  const noRedact = process.env.NEXTFORGE_NO_REDACT === "1";

  // Performance: only compute safePayload when mode is not off
  const { bytes, hash, preview } = safePayload(payload, {
    maxPreviewBytes: maxBytes,
    noRedact,
  });

  if (mode === "summary") {
    logger.info({ label, bytes, hash, preview }, `Data: ${label}`);
  } else if (mode === "full") {
    // Use info level so full mode is also visible without --verbose
    logger.info({ label, bytes, hash, preview }, `Data (full): ${label}`);
  }
}
