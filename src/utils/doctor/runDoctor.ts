import type { CheckContext } from "./checks.js";
import { getChecks } from "./checks.js";
import { formatResults } from "./format.js";

export interface DoctorResult {
  id: string;
  title: string;
  status: "pass" | "warn" | "fail";
  message: string;
}

export interface DoctorFlags {
  app?: string;
  json?: boolean;
  fix?: boolean;
  ci?: boolean;
  deep?: boolean;
  verbose?: boolean;
}

export async function runDoctor(flags: DoctorFlags): Promise<number> {
  const ctx: CheckContext = {
    cwd: process.cwd(),
    flags,
  };

  const checks = getChecks();
  const results: DoctorResult[] = [];

  for (const check of checks) {
    try {
      const res = await check.run(ctx);
      results.push({
        id: check.id,
        title: check.title,
        status: res.status,
        message: res.message,
      });
    } catch (err) {
      results.push({
        id: check.id,
        title: check.title,
        status: "fail",
        message: (err as Error).message,
      });
    }
  }

  const exitCode = formatResults(results, flags);
  return exitCode;
}
