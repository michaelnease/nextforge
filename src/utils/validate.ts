/**
 * Assert valid group name.
 */
export function assertValidGroup(group: string): void {
  const allowed = ["ui", "layout", "section", "feature"];
  if (!allowed.includes(group.toLowerCase())) {
    throw new Error("Invalid --group");
  }
}

/**
 * Assert valid framework.
 * Allows: react, next, chakra, tailwind, basic, both (for compatibility)
 */
export function assertValidFramework(fw: string | undefined): void {
  if (!fw) return;
  const allowed = ["react", "next", "chakra", "tailwind", "basic", "both"];
  if (!allowed.includes(fw.toLowerCase())) {
    throw new Error("Invalid --framework. Use one of: chakra, tailwind, basic, both");
  }
}

/**
 * Assert valid component name.
 */
export function assertValidComponentName(name: string): void {
  // Check for path traversal
  if (name.includes("..")) {
    throw new Error("Path traversal detected");
  }
  if (name.includes("./") || name.startsWith(".")) {
    throw new Error("Invalid component name");
  }

  // Check for spaces
  if (name.includes(" ")) {
    throw new Error("Invalid component name");
  }

  // PascalCase pattern: starts with uppercase letter, followed by alphanumeric
  if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) {
    throw new Error("Invalid component name");
  }

  // Check for starting number
  if (/^\d/.test(name)) {
    throw new Error("Invalid component name");
  }
}

/**
 * Assert valid route segment.
 * Supports standard segments (a-z, 0-9, -, [, ]) and route groups like (marketing)
 * Also supports dynamic segments like [slug], [...slug], [[...slug]]
 */
export function assertValidRouteSegment(seg: string): void {
  // Check if it's a route group: (name)
  const routeGroupPattern = /^\([a-z0-9-]+\)$/i;
  if (routeGroupPattern.test(seg)) {
    return; // Valid route group
  }

  // Check if it's a dynamic segment: [slug], [...slug], [[...slug]]
  const dynamicPattern = /^\[{1,2}\.{0,3}[a-z0-9_-]+\]{1,2}$/i;
  if (dynamicPattern.test(seg)) {
    return; // Valid dynamic segment
  }

  // Standard segment validation
  if (!/^[a-z0-9-]+$/i.test(seg)) {
    throw new Error("Invalid segment");
  }
}

/**
 * Validate component name format: group/Name where group is one of
 * {ui, layout, section, feature} and Name is PascalCase starting with A-Z.
 * Rejects spaces, special chars, leading dot, names starting with number.
 */
export function validateComponentName(input: string): {
  group: string;
  name: string;
  subdirs: string[];
} {
  // Check for path traversal
  if (input.includes("..")) {
    throw new Error("Path traversal detected");
  }
  if (input.includes("./") || input.startsWith(".")) {
    throw new Error("Invalid component name");
  }

  // Check for spaces
  if (input.includes(" ")) {
    throw new Error("Invalid component name");
  }

  const parts = input.split("/").filter(Boolean);

  if (parts.length === 0) {
    throw new Error("Invalid component name");
  }

  // Extract group and name
  let group: string | undefined;
  let nameStr: string;
  let subdirs: string[] = [];

  if (parts.length === 1) {
    // Just name, no group in path
    nameStr = parts[0]!;
  } else {
    // Check if first part is a valid group
    const validGroups = ["ui", "layout", "section", "feature"];
    if (validGroups.includes(parts[0]!.toLowerCase())) {
      // First part is group
      group = parts[0]!;
      // Remaining parts (except last) are subdirectories
      subdirs = parts.slice(1, -1);
      nameStr = parts[parts.length - 1]!;
    } else {
      // No group in path, all parts except last are subdirectories
      subdirs = parts.slice(0, -1);
      nameStr = parts[parts.length - 1]!;
    }
  }

  // Convert subdirectories to PascalCase
  function toPascalCase(str: string): string {
    return str
      .split(/[-_\s]+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join("");
  }
  const pascalSubdirs = subdirs.map(toPascalCase);

  // Validate group if present in path
  const validGroups = ["ui", "layout", "section", "feature"];
  if (group && !validGroups.includes(group.toLowerCase())) {
    throw new Error("Invalid component name");
  }

  // Validate name
  assertValidComponentName(nameStr);

  return {
    group: group?.toLowerCase() || "ui",
    name: nameStr,
    subdirs: pascalSubdirs,
  };
}

/**
 * Validate page route segment.
 * Route segments are [a-z0-9\-\[\]]+ only.
 */
export function validatePageRoute(input: string): void {
  // Remove leading/trailing slashes
  const clean = input.trim().replace(/^\/+|\/+$/g, "");

  if (!clean) {
    throw new Error("Invalid segment");
  }

  // Split into segments
  const segments = clean.split("/");

  for (const seg of segments) {
    assertValidRouteSegment(seg);
  }
}

/**
 * Validate and normalize group name.
 * Normalize to (name); reject reserved "api".
 */
export function validateGroupName(name: string): string {
  const trimmed = name.trim();

  if (!trimmed) {
    throw new Error("Group name is required");
  }

  // Remove parentheses if present
  const core = trimmed.startsWith("(") && trimmed.endsWith(")") ? trimmed.slice(1, -1) : trimmed;

  // Check reserved name
  if (core.toLowerCase() === "api") {
    throw new Error('reserved "api"');
  }

  // Normalize to (name) format
  return `(${core})`;
}
