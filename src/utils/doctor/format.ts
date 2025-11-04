import kleur from "kleur";

import type { DoctorResult, DoctorFlags } from "./runDoctor.js";

export function formatResults(results: DoctorResult[], flags: DoctorFlags): number {
  const ci = flags.ci || flags.json;
  const lines: string[] = [];

  let failed = 0;
  let warned = 0;

  for (const r of results) {
    const color =
      r.status === "pass" ? kleur.green : r.status === "warn" ? kleur.yellow : kleur.red;

    const statusText = r.status.toUpperCase();
    const statusDisplay = ci ? statusText : color(statusText);
    lines.push(`${statusDisplay}  ${r.title}: ${r.message}`);

    if (r.status === "fail") failed++;
    if (r.status === "warn") warned++;
  }

  if (flags.json) {
    console.log(
      JSON.stringify(
        {
          ok: failed === 0,
          results: results.map((r) => ({
            id: r.id,
            title: r.title,
            status: r.status,
            message: r.message,
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
  }

  if (failed > 0) return 2;
  if (warned > 0) return 1;
  return 0;
}
