import kleur from "kleur";

import type { DoctorResult, DoctorFlags } from "./runDoctor.js";

/**
 * Check if colors should be disabled based on environment variables
 */
function shouldDisableColors(): boolean {
  return (
    process.env.NO_COLOR !== undefined ||
    process.env.FORCE_COLOR === "0" ||
    process.env.TERM === "dumb"
  );
}

export function formatResults(results: DoctorResult[], flags: DoctorFlags): number {
  const disableColors = flags.ci || flags.json || shouldDisableColors();
  const lines: string[] = [];

  let passed = 0;
  let failed = 0;
  let warned = 0;

  for (const r of results) {
    const color =
      r.status === "pass" ? kleur.green : r.status === "warn" ? kleur.yellow : kleur.red;

    const statusText = r.status.toUpperCase();
    const statusDisplay = disableColors ? statusText : color(statusText);
    lines.push(`${statusDisplay}  ${r.title}: ${r.message}`);

    // Include details if verbose
    if (r.details && flags.verbose) {
      lines.push(`  Details: ${r.details}`);
    }

    // Include fix suggestions
    if (r.fix && r.fix.length > 0) {
      lines.push(`  Fix suggestions:`);
      for (const suggestion of r.fix) {
        lines.push(`    - ${suggestion}`);
      }
    }

    if (r.status === "pass") passed++;
    if (r.status === "fail") failed++;
    if (r.status === "warn") warned++;
  }

  const exitCode = failed > 0 ? 2 : warned > 0 ? 1 : 0;

  if (flags.json) {
    console.log(
      JSON.stringify(
        {
          schema: "nextforge.doctor@1",
          ok: failed === 0,
          exitCode,
          summary: {
            passed,
            warnings: warned,
            failed,
            total: results.length,
          },
          results: results.map((r) => ({
            id: r.id,
            title: r.title,
            status: r.status,
            message: r.message,
            details: r.details,
            fix: r.fix,
          })),
        },
        null,
        2
      )
    );
  } else {
    console.log("\nNextForge Doctor Report\n");
    console.log(lines.join("\n"));
    console.log();

    // Summary footer
    const summaryParts = [];
    if (passed > 0) summaryParts.push(`${passed} passed`);
    if (warned > 0) summaryParts.push(`${warned} warnings`);
    if (failed > 0) summaryParts.push(`${failed} failed`);

    console.log(`Summary: ${summaryParts.join(", ")} • Exit ${exitCode}\n`);
  }

  if (failed > 0) return 2;
  if (warned > 0) return 1;
  return 0;
}
