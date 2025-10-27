#!/usr/bin/env node

import { Command } from 'commander';
import { doctorCommand } from './commands/doctor.js';

const program = new Command();

program
  .name('nextforge')
  .description('A CLI tool for Next.js project scaffolding and management')
  .version('0.1.0');

// Add doctor command
program.addCommand(doctorCommand);

export function main(): void {
  program.parse();
}

// Only run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
