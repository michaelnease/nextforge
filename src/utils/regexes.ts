/**
 * Central registry of sensitive key names and value patterns for redaction
 */

/**
 * Sensitive key names that should be redacted
 */
export const SENSITIVE_KEYS = [
  "password",
  "passwd",
  "pwd",
  "secret",
  "token",
  "authorization",
  "auth",
  "cookie",
  "apiKey",
  "api_key",
  "accessKeyId",
  "access_key_id",
  "secretAccessKey",
  "secret_access_key",
  "sessionToken",
  "session_token",
  "privateKey",
  "private_key",
  "clientSecret",
  "client_secret",
  "bearer",
  "credentials",
  "apiSecret",
  "api_secret",
] as const;

/**
 * Check if a key name is sensitive (case-insensitive)
 */
export function isSensitiveKey(key: string, extraKeys: string[] = []): boolean {
  const lowerKey = key.toLowerCase();
  const allKeys = [
    ...SENSITIVE_KEYS.map((k) => k.toLowerCase()),
    ...extraKeys.map((k) => k.toLowerCase()),
  ];

  return allKeys.some((sensitive) => {
    // Exact match or contains the sensitive word
    return lowerKey === sensitive || lowerKey.includes(sensitive);
  });
}

/**
 * Patterns for sensitive values
 */
export const SENSITIVE_VALUE_PATTERNS = {
  // JWT tokens (3 base64 segments separated by dots)
  jwt: /^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,

  // AWS Access Key ID (AKIA followed by 16 alphanumeric)
  awsKeyId: /AKIA[0-9A-Z]{16}/,

  // AWS Secret Access Key (40 base64 characters)
  awsSecret: /^[A-Za-z0-9/+=]{40}$/,

  // Credit card like sequences (13-19 digits with optional spaces/dashes)
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,

  // OAuth tokens (long alphanumeric strings)
  oauthToken: /^[A-Za-z0-9_-]{32,}$/,

  // GitHub personal access tokens
  githubToken: /^gh[pousr]_[A-Za-z0-9_]{36,}$/,

  // npm tokens
  npmToken: /^npm_[A-Za-z0-9]{36}$/,

  // Bearer tokens in Authorization headers
  bearerToken: /^Bearer\s+[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
} as const;

/**
 * Check if a value matches any sensitive pattern
 */
export function isSensitiveValue(value: string): boolean {
  if (typeof value !== "string" || value.length < 10) {
    return false;
  }

  return Object.values(SENSITIVE_VALUE_PATTERNS).some((pattern) => pattern.test(value));
}

/**
 * Redact a sensitive value
 */
export function redactValue(value: unknown, key?: string, extraKeys: string[] = []): unknown {
  // Check if key is sensitive
  if (key && isSensitiveKey(key, extraKeys)) {
    return "[REDACTED]";
  }

  // For strings, check value patterns
  if (typeof value === "string") {
    if (isSensitiveValue(value)) {
      return "[REDACTED]";
    }
  }

  return value;
}
