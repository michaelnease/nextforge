import type { CheckContext } from "./checks.js";
import { getChecks } from "./checks.js";
import { formatResults } from "./format.js";

export interface DoctorResult {
  id: string;
  title: string;
  status: "pass" | "warn" | "fail";
  message: string;
  details?: string;
  fix?: string[];
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
      const result: DoctorResult = {
        id: check.id,
        title: check.title,
        status: res.status,
        message: res.message,
      };
      if (res.details) result.details = res.details;
      if (res.fix) result.fix = res.fix;
      results.push(result);
    } catch (err) {
      const error = err as Error;
      const result: DoctorResult = {
        id: check.id,
        title: check.title,
        status: "fail",
        message: error.message || "Unexpected error during check",
      };
      if (flags.verbose) {
        result.details = String(error.stack || err);
      }
      results.push(result);
    }
  }

  const exitCode = formatResults(results, flags);
  return exitCode;
}
