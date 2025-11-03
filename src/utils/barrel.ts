import { readText, writeText, exists } from "./fsx.js";

/**
 * Upsert export line in barrel file.
 * - Creates barrel if missing
 * - Inserts export exactly once
 * - Keeps lines unique
 * - Sort case-insensitive by the exported name
 */
export async function upsertExport(barrelPath: string, exportLine: string): Promise<void> {
  // Pattern to match export lines:
  // export { default as Name } from "Name/Name"
  // export * from './Name'
  const exportPattern = /^export \{?\s*(?:default as\s+)?(\w+)\s*\}?\s+from\s+["']([^"']+)["'];?$/;

  let content = "";
  if (await exists(barrelPath)) {
    content = await readText(barrelPath);
  }

  // Extract all existing export lines matching the pattern
  const lines = content.split(/\r?\n/).filter((line) => {
    const trimmed = line.trim();
    return trimmed && exportPattern.test(trimmed);
  });

  // Check if this export already exists (compare normalized)
  const normalizedLine = exportLine.trim().replace(/;?\s*$/, "");
  const existsAlready = lines.some((line) => {
    const normalized = line.trim().replace(/;?\s*$/, "");
    return normalized === normalizedLine;
  });

  if (!existsAlready) {
    // Add new export (ensure it has semicolon)
    const finalLine = normalizedLine.endsWith(";") ? normalizedLine : `${normalizedLine};`;
    lines.push(finalLine);
  }

  // Sort case-insensitive by the component name (first capture group)
  lines.sort((a, b) => {
    const matchA = a.match(exportPattern);
    const matchB = b.match(exportPattern);
    const nameA = (matchA?.[1] || "").toLowerCase();
    const nameB = (matchB?.[1] || "").toLowerCase();
    return nameA.localeCompare(nameB);
  });

  // Remove duplicates
  const uniqueLines = Array.from(new Set(lines));

  // Write back with newline
  await writeText(barrelPath, uniqueLines.join("\n") + "\n");
}
