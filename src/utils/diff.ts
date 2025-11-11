/**
 * Compact text diff helper for logging file changes
 */

export interface DiffHunk {
  added: boolean;
  removed: boolean;
  count: number;
  head: string;
}

/**
 * Simple line-based diff algorithm
 * Returns hunks with added/removed flags and preview text
 */
export function compactDiff(
  a: string,
  b: string,
  opts?: {
    maxHunks?: number;
    maxHead?: number;
  }
): DiffHunk[] {
  const { maxHunks = 3, maxHead = 160 } = opts || {};

  // Handle empty strings correctly (don't treat as [""])
  const linesA = a === "" ? [] : a.split("\n");
  const linesB = b === "" ? [] : b.split("\n");

  const hunks: DiffHunk[] = [];

  // Simple LCS-based diff
  const matrix: number[][] = [];
  for (let i = 0; i <= linesA.length; i++) {
    matrix[i] = [];
    for (let j = 0; j <= linesB.length; j++) {
      if (i === 0 || j === 0) {
        matrix[i]![j] = 0;
      } else if (linesA[i - 1] === linesB[j - 1]) {
        matrix[i]![j] = matrix[i - 1]![j - 1]! + 1;
      } else {
        matrix[i]![j] = Math.max(matrix[i - 1]![j]!, matrix[i]![j - 1]!);
      }
    }
  }

  // Backtrack to find diff
  let i = linesA.length;
  let j = linesB.length;
  const changes: Array<{ type: "equal" | "add" | "remove"; line: string }> = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      changes.unshift({ type: "equal", line: linesA[i - 1]! });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || matrix[i]![j - 1]! >= matrix[i - 1]![j]!)) {
      changes.unshift({ type: "add", line: linesB[j - 1]! });
      j--;
    } else if (i > 0) {
      changes.unshift({ type: "remove", line: linesA[i - 1]! });
      i--;
    }
  }

  // Group consecutive changes into hunks
  let currentType: "equal" | "add" | "remove" | null = null;
  let currentLines: string[] = [];

  const flushHunk = () => {
    if (currentType && currentType !== "equal" && currentLines.length > 0) {
      const content = currentLines.join("\n");
      const head = content.length > maxHead ? content.substring(0, maxHead) + "..." : content;

      hunks.push({
        added: currentType === "add",
        removed: currentType === "remove",
        count: currentLines.length,
        head,
      });
    }
    currentLines = [];
  };

  for (const change of changes) {
    if (change.type === "equal") {
      flushHunk();
      currentType = null;
    } else {
      if (currentType !== change.type) {
        flushHunk();
        currentType = change.type;
      }
      currentLines.push(change.line);
    }
  }

  flushHunk();

  // Limit to maxHunks
  if (hunks.length > maxHunks) {
    const remaining = hunks.length - maxHunks;
    return [
      ...hunks.slice(0, maxHunks),
      {
        added: false,
        removed: false,
        count: remaining,
        head: `... and ${remaining} more hunks`,
      },
    ];
  }

  return hunks;
}
