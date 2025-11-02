## NextForge - Editing Guide for AI

### File Structure

- Commands live under `src/commands/**`.
- Utilities live under `src/utils/**`.
- Tests live in `src/**/*.test.ts` using Vitest.
- Smoke tests in `scripts/smoke-*.mjs`.
- CI configuration in `.github/workflows/ci.yml`.

### Command Registration

Register all commands inside the anchor block `[nextforge.register:commands]` in `src/index.ts`:

- Start: `// [nextforge.register:commands:start]`
- End: `// [nextforge.register:commands:end]`

### Template Anchors

Component and page template anchors (for consistent edits) live in `src/commands/add/group.ts`:

- Layout: `[nextforge.templates:layout:start]` … `[nextforge.templates:layout:end]`
- Tailwind page: `[nextforge.templates:page.tailwind:start]` … `[nextforge.templates:page.tailwind:end]`
- Basic page: `[nextforge.templates:page.basic:start]` … `[nextforge.templates:page.basic:end]`
- Chakra page: `[nextforge.templates:page.chakra:start]` … `[nextforge.templates:page.chakra:end]`

Do not edit outside anchor blocks unless explicitly instructed.

### Configuration

- Config is loaded with `loadConfig` and merged via `mergeConfig`.
- Precedence: CLI flags → env → config file → defaults.
- Config files: `nextforge.config.{ts,js,json}` supported.

### Testing Strategy

- **Unit Tests**: Vitest tests in `src/**/*.test.ts` or `src/**/*.golden.test.ts`
- **Smoke Tests**: End-to-end tests in `scripts/smoke-*.mjs` that run built CLI
- **Test Utilities**: `tests/utils/tempWorkspace.ts` provides isolated test environments
- Run tests: `npm test` (watch) or `npm run test:run` (once)
- Run smoke tests: `npm run smoke:add-component`

### Path Normalization Rules

**Critical**: Always use POSIX (forward slash) paths in generated code and imports.

1. **For Import Paths**: Use `toPosix()` utility function before writing import statements

   ```typescript
   const importPath = toPosix(path.relative(barrelDir, componentPath));
   ```

2. **For File System Operations**: Use Node.js `path.join()` and `path.resolve()` for actual file paths

3. **For Display**: Use `path.relative(process.cwd(), filePath)` to show relative paths in logs

4. **Barrel Exports**: Calculate relative path from barrel file to component, normalize to POSIX, then use in export statement

### Atomic Writes and Concurrency

1. **Manifest Writes**: Always use temp file + rename pattern:

   ```typescript
   const tmpPath = manifestPath + ".tmp";
   await fs.writeFile(tmpPath, contents, "utf8");
   await fs.rename(tmpPath, manifestPath);
   ```

2. **Idempotent Operations**: Check for existing content before appending (barrel exports, manifest entries)

3. **File Locks**: Use `writeIfAbsent()` pattern that respects `--force` flag

### Error Handling

- Validation errors should list allowed values explicitly
- Use `process.exitCode = 1` and rethrow errors so tests can catch them
- Log relative paths in error messages

### Logging

- Respect `--verbose` flag from root command
- Guard debug logs with `if (program.opts().verbose)`
- Default output should be quiet except for success summaries and errors
- Use relative paths in log messages: `path.relative(process.cwd(), filePath)`

### File Conventions

- All generated files must end with a newline (`\n`)
- Use consistent import order: Node built-ins → third-party → local
- Prefer `const` over `let` when possible
- Use named exports unless exporting React components or CLI entry points
