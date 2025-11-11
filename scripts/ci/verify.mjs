#!/usr/bin/env node
import { execSync } from "node:child_process";

const steps = [
  { name: "Lint", cmd: "npm run lint" },
  { name: "Format check", cmd: "npm run format:check" },
  { name: "Type check", cmd: "npm run typecheck" },
  { name: "Build", cmd: "npm run build" },
  { name: "Tests", cmd: "npm run test:run" },
  { name: "Verify tests", cmd: "npm run test:verify" },
  { name: "CLI help", cmd: "node bin/nextforge.js --help" },
];

function run(cmd, options = {}) {
  try {
    execSync(cmd, { stdio: "inherit", ...options });
    return 0;
  } catch (err) {
    return err.status || 1;
  }
}

// Run all steps
for (const step of steps) {
  const code = run(step.cmd);
  if (code !== 0) {
    console.error(`\n❌ ${step.name} failed with exit code ${code}`);
    process.exit(code);
  }
}

// Run doctor separately and allow warnings (exit code 1)
console.log("\nRunning doctor...");
const doctorExit = run("node bin/nextforge.js doctor");

if (doctorExit === 0 || doctorExit === 1) {
  console.log("\n✅ All verification checks passed!");
  if (doctorExit === 1) {
    console.log("   (Doctor found non-critical warnings - this is OK)");
  }
  process.exit(0);
} else {
  console.error(`\n❌ Doctor found critical failures (exit code ${doctorExit})`);
  process.exit(doctorExit);
}
