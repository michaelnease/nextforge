# Scripts Directory

This directory contains utility scripts organized by purpose.

## Structure

- **`ci/`** - CI/CD and verification scripts
  - `verify.mjs` - Runs all verification checks (lint, format, typecheck, build, tests, doctor)

- **`test/`** - Test and smoke test scripts
  - `smoke-add-component.mjs` - Smoke test for `add:component` command across different config variants

- **`utils/`** - Development utility scripts
  - `zip-pr-diff.mjs` - Creates a zip file of changed files between git refs (see `README-zip-pr-diff.md`)

- **`temp/`** - Temporary output directory (gitignored)
  - Used by `zip-pr-diff.mjs` for output files

## Usage

Run scripts via npm:

```bash
npm run verify          # Run all verification checks
npm run smoke           # Run smoke tests
npm run zip:pr          # Create PR diff zip
```

Or directly:

```bash
node scripts/ci/verify.mjs
node scripts/test/smoke-add-component.mjs
node scripts/utils/zip-pr-diff.mjs
```
