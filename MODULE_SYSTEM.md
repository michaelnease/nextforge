# Module System Documentation

This document clarifies the module system configuration for nextforge.

## ESM-Only Package

nextforge is a **pure ESM package**:

- `"type": "module"` in package.json
- All source files use ESM syntax (`import`/`export`)
- No CommonJS output or dual package support

## Configuration

### package.json

```json
{
  "type": "module",
  "engines": {
    "node": ">=18.18.0"
  },
  "bin": {
    "nextforge": "./bin/nextforge.js"
  },
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist"
  }
}
```

## Node.js Compatibility

**Supported Versions**: Node.js 18.18.0+ and 22.x

**Target: ES2022**

- Ensures compatibility with Node 18.18.0
- Includes features like:
  - Top-level await
  - `import.meta`
  - Class fields
  - Error.cause

**Avoided APIs**:

- No Node 20+ only features (e.g., `import.meta.dirname`)
- All built-in modules use `node:` prefix for clarity
- No experimental features

## Binary Entry Point

The CLI binary at `bin/nextforge.js`:

1. Uses ESM syntax (`import.meta.url`)
2. Dynamically imports `dist/index.js`
3. Calls the exported `main()` function
4. Handles errors and sets exit codes

```javascript
#!/usr/bin/env node
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mod = await import(join(__dirname, "../dist/index.js"));
const main = typeof mod.main === "function" ? mod.main : null;

if (!main) {
  console.error("nextforge: dist/index.js did not export main()");
  process.exit(1);
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exitCode = 1;
});
```

## Exports

The package exports:

- **Main entry**: `dist/index.js` with TypeScript types at `dist/index.d.ts`
- **Public API**: `createCursorRules`, `createCursorPhase`, `main`
- **CLI**: `nextforge` binary command

## Published Files

Only production-ready files are published:

- `bin/` - CLI entry point
- `dist/` - Compiled JavaScript and TypeScript declarations
- `README.md` - Documentation
- `LICENSE` - License file

Source files (`src/`), tests, and configuration are excluded via `.npmignore`.

## Verification

To verify the module system is working:

```bash
# Check package structure
npm pack --dry-run

# Test ESM import
node -e "import('./dist/index.js').then(m => console.log('OK'))"

# Test CLI binary
node bin/nextforge.js --version
```

## Migration Notes

If you're maintaining this package:

1. **Keep ES2022 target** - Don't bump to ES2023+ to maintain Node 18 support
2. **Use `node:` prefix** - Always import built-ins with `node:` prefix
3. **Test on Node 18 and 22** - CI tests both versions
4. **No CommonJS** - This is ESM-only, no dual package support
5. **File extensions** - Import paths in source must end in `.js` (not `.ts`)

## Common Issues

### Import Extensions

❌ Wrong: `import { foo } from './utils'`
✅ Correct: `import { foo } from './utils.js'`

### Dynamic Imports

✅ Correct: Use `await import()` or `import()` with `.then()`

### **dirname/**filename

❌ Not available in ESM
✅ Use: `fileURLToPath(import.meta.url)` and `dirname()`

### require()

❌ Not available in ESM
✅ Use: `createRequire(import.meta.url)` for CJS interop (rare)
