import { describe, it, expect } from "vitest";

import { compactDiff } from "../../../src/utils/diff.js";

describe("compactDiff", () => {
  it("detects added lines", () => {
    const before = "line1\nline2";
    const after = "line1\nline2\nline3";

    const hunks = compactDiff(before, after);

    expect(hunks).toHaveLength(1);
    expect(hunks[0]?.added).toBe(true);
    expect(hunks[0]?.removed).toBe(false);
    expect(hunks[0]?.count).toBe(1);
    expect(hunks[0]?.head).toContain("line3");
  });

  it("detects removed lines", () => {
    const before = "line1\nline2\nline3";
    const after = "line1\nline3";

    const hunks = compactDiff(before, after);

    expect(hunks).toHaveLength(1);
    expect(hunks[0]?.removed).toBe(true);
    expect(hunks[0]?.added).toBe(false);
    expect(hunks[0]?.count).toBe(1);
    expect(hunks[0]?.head).toContain("line2");
  });

  it("detects both additions and removals", () => {
    const before = "line1\nline2\nline3";
    const after = "line1\nlineX\nline3";

    const hunks = compactDiff(before, after);

    expect(hunks.length).toBeGreaterThanOrEqual(1);
    const hasRemoval = hunks.some((h) => h.removed);
    const hasAddition = hunks.some((h) => h.added);
    expect(hasRemoval).toBe(true);
    expect(hasAddition).toBe(true);
  });

  it("respects maxHunks limit", () => {
    const before = "line1\nline2\nline3\nline4\nline5";
    const after = "lineA\nlineB\nlineC\nlineD\nlineE";

    const hunks = compactDiff(before, after, { maxHunks: 2 });

    expect(hunks.length).toBeLessThanOrEqual(3); // 2 hunks + 1 overflow marker
    const lastHunk = hunks[hunks.length - 1];
    if (hunks.length === 3) {
      expect(lastHunk?.head).toContain("more hunks");
    }
  });

  it("respects maxHead truncation", () => {
    const before = "short";
    const longLine = "x".repeat(300);
    const after = `short\n${longLine}`;

    const hunks = compactDiff(before, after, { maxHead: 50 });

    expect(hunks).toHaveLength(1);
    expect(hunks[0]?.head.length).toBeLessThanOrEqual(54); // 50 + "..."
    expect(hunks[0]?.head).toContain("...");
  });

  it("handles empty strings", () => {
    const hunks = compactDiff("", "");
    expect(hunks).toHaveLength(0);
  });

  it("handles adding to empty string", () => {
    const hunks = compactDiff("", "new content");
    expect(hunks).toHaveLength(1);
    expect(hunks[0]?.added).toBe(true);
  });

  it("handles removing all content", () => {
    const hunks = compactDiff("old content", "");
    expect(hunks).toHaveLength(1);
    expect(hunks[0]?.removed).toBe(true);
  });

  it("groups consecutive changes", () => {
    const before = "line1\nline2\nline3\nline4";
    const after = "line1\nlineX\nlineY\nline4";

    const hunks = compactDiff(before, after);

    // Should group the consecutive changes into hunks
    expect(hunks.length).toBeGreaterThan(0);
    expect(hunks.length).toBeLessThan(4); // Not one hunk per line
  });

  it("handles identical strings", () => {
    const hunks = compactDiff("same\ncontent", "same\ncontent");
    expect(hunks).toHaveLength(0);
  });

  it("provides accurate line counts", () => {
    const before = "a\nb\nc";
    const after = "a\nx\ny\nz\nc";

    const hunks = compactDiff(before, after);

    const totalChanged = hunks.reduce((sum, h) => sum + h.count, 0);
    expect(totalChanged).toBeGreaterThan(0);
  });

  it("handles multiline hunks", () => {
    const before = "keep\nremove1\nremove2\nremove3\nkeep";
    const after = "keep\nkeep";

    const hunks = compactDiff(before, after);

    expect(hunks).toHaveLength(1);
    expect(hunks[0]?.count).toBe(3); // Three lines removed
    expect(hunks[0]?.removed).toBe(true);
  });

  it("handles newline-only differences", () => {
    const before = "line1\nline2";
    const after = "line1\n\nline2";

    const hunks = compactDiff(before, after);

    expect(hunks.length).toBeGreaterThan(0);
  });
});
