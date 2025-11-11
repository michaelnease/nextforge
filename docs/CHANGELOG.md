# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Distributed Tracing System**
  - Trace IDs for correlating logs across command execution
  - Span IDs for tracking individual operations within commands
  - Human-readable trace trees with `--trace` flag
  - Custom trace ID support via `NEXTFORGE_TRACE_ID` env var
  - AsyncLocalStorage-based context propagation
  - Automatic trace context injection into all logs
  - Final summary logs with traceId and exitCode

- **Data Introspection (`--log-data`)**
  - Safe data logging for debugging command execution
  - Three modes: `off`, `summary` (512 bytes), `full` (4096 bytes)
  - Automatic redaction of sensitive keys (passwords, tokens, API keys)
  - Custom redaction with `--redact` flag
  - Disable redaction for local dev with `--no-redact`
  - Structured logging with labels, hashes, and byte counts

- **Performance Profiling (`--profile`)**
  - Wall time, CPU usage, and memory tracking
  - Event loop delay monitoring (p50, p90, p99, max)
  - Garbage collection event tracking by type
  - I/O operation counting and byte tracking
  - Human-readable and JSON output formats
  - Metrics-only mode with `--metrics json`

- **Component Generation Command (`add:component`)**
  - Support for component groups: `ui`, `layout`, `section`, `feature`
  - Framework-aware templates: Tailwind, Chakra UI, Basic, and hybrid (both frameworks)
  - Client/server component support with `--client` flag
  - Test file generation with `--with-tests`
  - Style file generation with `--with-style` (CSS modules for basic, Chakra styles for Chakra, skipped for Tailwind)
  - Storybook story generation with `--with-story`
  - Automatic barrel file exports with POSIX path normalization
  - Atomic manifest writes for `.nextforge/manifest.json`
  - Comprehensive name and group validation
  - Force overwrite support with `--force` flag
  - Verbose logging with `--verbose` flag

- **Page and API Route Generation (`add:page`)**
  - Support for dynamic routes, catch-all routes, and route groups
  - Async server components, client components, and API routes
  - Optional layout, loading, and error boundaries

- **Route Group Generation (`add:group`)**
  - Create Next.js App Router route groups with optional layouts and child pages

- **Project Configuration**
  - Support for `nextforge.config.{ts,js,json}` files
  - Environment variable overrides
  - Framework detection (Tailwind CSS, Chakra UI)

- **Diagnostics (`doctor` command)**
  - Project health checks and diagnostics
  - CI-friendly mode with `--ci` flag (warnings don't fail builds)
  - JSON output with `--json` flag
  - Exit code conventions: 0 (pass), 1 (warnings), 2 (failures)

- **CI/CD**
  - GitHub Actions workflow with Node.js 18, 20, and 22 support
  - Comprehensive test suite with Vitest
  - Smoke tests for component generation
  - Automated linting, type checking, and formatting

### Changed

- **Doctor command**: In CI mode (`--ci` flag or `CI` env var), warnings (exit code 1) now exit with 0 to allow CI builds to pass
- Improved error messages with explicit allowed values
- Enhanced logging with relative paths and structured JSON
- Consistent cross-platform path handling (POSIX normalization)
- All commands now support `--trace`, `--profile`, and `--log-data` flags

### Fixed

- Barrel export idempotence (no duplicate exports)
- Manifest write atomicity and uniqueness
- Cross-platform import path consistency
- File newline preservation
- Trace context propagation across async operations
- Final summary logs emitted in both success and failure cases

### Documentation

- Comprehensive README with examples for all commands
- FOR_AI.md guide for contributors
- PR template with checklist
- CHANGELOG.md for version history

## [0.1.0] - Initial Release

Initial release with basic scaffolding capabilities.

[1.0.0]: https://github.com/forged/nextforge/releases/tag/v1.0.0
[0.1.0]: https://github.com/forged/nextforge/releases/tag/v0.1.0
