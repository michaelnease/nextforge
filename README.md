# @forged/nextforge

A modern CLI tool for Next.js project scaffolding and management, built with TypeScript and ESM.

## 📚 Documentation

- **[Changelog](docs/CHANGELOG.md)** - Version history and release notes
- **[Contributor Guide](docs/FOR_AI.md)** - Editing guide for contributors and AI assistants
- **[Distributed Tracing](docs/tracing.md)** - Trace correlation and span trees
- **[Data Introspection](docs/LOGGING_DATA.md)** - Safe data logging and debugging
- **[License](docs/LICENSE)** - MIT License

---

## Table of Contents

- [Features](#features)
  - [Modern CLI Architecture](#-modern-cli-architecture)
  - [Development Tools](#-development-tools)
  - [Built-in Utilities](#-built-in-utilities)
  - [Developer Experience](#-developer-experience)
  - [Project Management](#-project-management)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Usage](#usage)
  - [CLI Commands](#cli-commands)
  - [Page and API Route Generation](#page-and-api-route-generation)
  - [Project-wide Configuration](#project-wide-configuration)
  - [Component Generation](#component-generation)
  - [Route Group Generation](#route-group-generation)
- [Development](#development)
  - [Quick Start for Contributors](#quick-start-for-contributors)
  - [Setup](#setup)
  - [Local Development](#local-development)
  - [Project Structure](#project-structure)
  - [Development Commands](#development-commands)
  - [Git Hooks](#git-hooks)
  - [Utility Scripts](#utility-scripts)
- [Technical Specifications](#technical-specifications)
  - [Runtime Requirements](#runtime-requirements)
  - [Build Output](#build-output)
  - [Code Quality](#code-quality)
  - [Testing & CI](#testing--ci)
- [Requirements](#requirements)
- [License](#license)

---

## Features

### 🏗️ **Modern CLI Architecture**

- **ESM-only** Node.js 18.18+ support
- **TypeScript** with full type safety
- **Commander.js** for robust argument parsing
- **Cross-platform** compatibility

### 🔧 **Development Tools**

- **ESLint + Prettier** for code quality
- **Vitest** for fast testing
- **TypeScript declarations** for library consumers
- **Comprehensive CI/CD** with GitHub Actions (see `.github/workflows/ci.yml`)

### 📦 **Built-in Utilities**

- **Doctor command** for project diagnostics
- **Route group generator** for Next.js App Router
- **Page and API route generator** with comprehensive scaffolding
- **PR diff zipper** for change tracking
- **Build verification** with smoke tests
- **Package validation** with npm pack checks

### 🚀 **Developer Experience**

- **One-command verification** (`npm run verify`)
- **Hot reload development** (`npm run dev`)
- **Automatic formatting** and linting
- **Comprehensive error handling**
- **Smart input validation** and sanitization

### 📋 **Project Management**

- **Git integration** for change tracking
- **Manifest generation** with file checksums
- **Dependency validation** and security checks
- **Cross-platform script execution**

## Quick start

```bash
npm i -D @forged/nextforge

npx nextforge --help
npx nextforge doctor
```

## Installation

```bash
npm install -g @forged/nextforge
```

Or use with npx:

```bash
npx @forged/nextforge
```

## Usage

### CLI Commands

```bash
# Show help and available commands
nextforge --help

# Show version information
nextforge --version

# Run project diagnostics
nextforge doctor

# Create Next.js route groups
nextforge add:group <name> [options]

# Create Next.js pages and API routes
nextforge add:page <route> [options]

# Scaffold a NextForge config
nextforge init

# Create components
nextforge add:component <name> --kind <ui|layout|section|feature> [options]

# Create Cursor AI rule files and phase prompts
nextforge add:cursor <type> [options]
```

### Page and API Route Generation

Create Next.js App Router pages and API routes with comprehensive scaffolding:

```bash
# Basic page creation
nextforge add:page about

# Dynamic routes
nextforge add:page "blog/[slug]"
nextforge add:page "docs/[...parts]"
nextforge add:page "admin/[[...maybe]]"

# API routes (auto-detects and skips page creation)
nextforge add:page "api/users" --api --error

# Pure API routes (no page.tsx)
nextforge add:page "api/posts" --skip-page --api --error

# Route groups
nextforge add:page "profile" --group auth --client --layout

# Complex scaffolding
nextforge add:page "dashboard/settings" --group admin --async --api --layout --loading --error

# Overwrite existing files
nextforge add:page "about" --force --client --layout
```

### Project-wide configuration

NextForge reads an optional `nextforge.config.ts`/`nextforge.config.js`/`nextforge.config.json` from your project root
to control defaults like Tailwind/Chakra usage, default layout, and pages dir.

Example `nextforge.config.ts`:

```ts
export default {
  useTailwind: true,
  useChakra: false,
  defaultLayout: "main",
  pagesDir: "app",
  cursorDir: ".nextforge/cursor",
  dockerCompose: true,
};
```

#### Config Precedence

Configuration values are resolved in the following order (highest to lowest priority):

1. **CLI flags** - Explicit command-line arguments (e.g., `--framework tailwind`)
2. **Environment variables** - `NEXTFORGE_*` environment variables
3. **Config file** - `nextforge.config.{ts,js,json}` in project root
4. **Defaults** - Built-in sensible defaults

**Environment variables:**

- `NEXTFORGE_USE_TAILWIND` (`true|false`)
- `NEXTFORGE_USE_CHAKRA` (`true|false`)
- `NEXTFORGE_DEFAULT_LAYOUT` (string)
- `NEXTFORGE_PAGES_DIR` (string)
- `NEXTFORGE_LOG_LEVEL` (`error|warn|info|debug|trace`) - Set logging verbosity (default: `info`)
- `NEXTFORGE_PROFILE` (`1|true`) - Enable performance profiling for all commands
- `NEXTFORGE_METRICS` (`json`) - Output metrics as JSON only (equivalent to --metrics json)
- `FORCE_JSON_LOGS` (`1|true`) - Force plain JSON output even in TTY (useful for pipes)

### Logging and Diagnostics

NextForge includes built-in structured logging powered by Pino for debugging and monitoring command execution.

**Log Levels:**

- `error` - Only critical errors
- `warn` - Warnings and errors
- `info` - General information (default)
- `debug` - Detailed debugging information
- `trace` - Very detailed trace information

**Configuration:**

```bash
# Enable verbose logging with --verbose flag
nextforge add:page reports --verbose

# Or set log level via environment variable
export NEXTFORGE_LOG_LEVEL=debug
nextforge add:page reports

# Run doctor with verbose output
nextforge doctor --verbose

# Force JSON output for local pipes (disables pretty printing)
export FORCE_JSON_LOGS=1
nextforge add:page reports | jq
```

**Log Files:**

All commands automatically write structured JSON logs to `.nextforge/logs/YYYY-MM-DD.log` (e.g., `.nextforge/logs/2025-11-06.log`) for auditing and debugging. Each log entry includes:

- Command name and version
- Unique run ID (UUID)
- Node.js version and platform
- Git SHA (if available)
- Start/end timestamps
- Duration and exit code
- Full error details and stack traces (if any)

**Example log output:**

```json
{
  "level": 30,
  "time": "2025-11-06T18:00:00.000Z",
  "version": "0.1.0",
  "nodeVersion": "v22.19.0",
  "platform": "linux-x64",
  "cmd": "add:page",
  "runId": "f5c54e4d-a804-4dc9-a777-ecf7520db2cd",
  "event": "start",
  "msg": "Starting command: add:page"
}
```

**Console Output:**

- **Development**: Colorized, human-readable output with `pino-pretty`
- **CI/Production**: Plain JSON output for parsing and analysis
- **Pipes**: Set `FORCE_JSON_LOGS=1` for predictable JSON in local pipes

**Examples:**

```bash
# View logs for today
cat .nextforge/logs/2025-11-06.log

# Filter error logs with jq
cat .nextforge/logs/2025-11-06.log | jq 'select(.level == 50)'

# Monitor logs in real-time
tail -f .nextforge/logs/2025-11-06.log | jq

# Debug a specific command
NEXTFORGE_LOG_LEVEL=debug nextforge add:page reports

# Pipe output as JSON
FORCE_JSON_LOGS=1 nextforge doctor | jq '.results[] | select(.status == "fail")'
```

### Data Introspection

NextForge includes safe data introspection to help debug commands without leaking secrets. Use the `--log-data` flag to inspect command inputs, template variables, and file operations.

**Modes:**

- `off` - No data logging (zero overhead)
- `summary` - Compact previews with 512 byte limit (default)
- `full` - Detailed previews with 4096 byte limit

**Quick Start:**

```bash
# Summary mode - safe for production
npx nextforge doctor --log-data summary

# Full mode - detailed local debugging
npx nextforge add:page Dashboard --log-data full

# Or use environment variable
export NEXTFORGE_LOG_DATA=summary
npx nextforge add:page Reports
```

**Security Features:**

- **Automatic Redaction** - Passwords, tokens, API keys, AWS credentials, JWTs automatically masked
- **Pattern Matching** - Credit cards, emails, OAuth tokens detected and redacted
- **URL Scrubbing** - Sensitive query parameters (`?token=`, `?key=`) automatically masked
- **Size Limiting** - Previews truncated to prevent log bloat
- **Content Hashing** - SHA256 hashes for verification without storing full content

**Custom Redaction:**

```bash
# Add custom keys to redact
npx nextforge add:page Contact --log-data summary --redact email,phone,projectId

# Disable redaction for local debugging (⚠️ WARNING: Use only in development!)
npx nextforge doctor --log-data full --no-redact
```

**Example Output:**

```json
{
  "label": "inputs",
  "bytes": 119,
  "hash": "c5273f427c02d665",
  "preview": "{\"command\":\"doctor\",\"runId\":\"[REDACTED]\"}",
  "msg": "Data: inputs"
}
```

See **[docs/LOGGING_DATA.md](docs/LOGGING_DATA.md)** for complete documentation.

### Performance Profiling

NextForge includes built-in performance profiling to track resource usage and identify bottlenecks in CLI commands.

**Profiling Metrics:**

- **Wall time** - Total execution time
- **CPU usage** - User and system CPU time (microseconds)
- **Memory** - Start, peak, and end RSS memory (MB)
- **Event loop** - Delay percentiles (p50, p90, p99, max) in milliseconds
- **Garbage collection** - GC events and durations by type
- **I/O** - File read/write operations and bytes transferred

**Enable Profiling:**

```bash
# Using command-line flag
nextforge doctor --profile

# Using environment variable
export NEXTFORGE_PROFILE=1
nextforge add:page reports

# Get JSON metrics only (no log output)
nextforge doctor --metrics json
nextforge add:page reports --metrics json | jq '.wallMs'
```

**Human-Readable Output (--profile):**

```bash
nextforge doctor --profile

# Output:
Performance Profile:
wall=132ms  cpuUser=41ms  cpuSys=6ms
memStart=62 MB → peak 80 MB → end 66 MB
eventLoop p50=1.2 ms p90=3.8 ms p99=6.4 ms max=12.1 ms
io reads=3 writes=1 bytesRead=18.2 KB bytesWritten=624 B
gc scavenge=1 mark-sweep-compact=1 total=4.3 ms
```

**JSON Metrics (--metrics json):**

```bash
nextforge doctor --metrics json | jq

# Output:
{
  "cmd": "doctor",
  "ok": true,
  "wallMs": 132.45,
  "cpu": {
    "userMs": 41.23,
    "systemMs": 6.15
  },
  "memory": {
    "startMB": 62.34,
    "peakMB": 80.12,
    "endMB": 66.45
  },
  "eventLoop": {
    "p50": 1.2,
    "p90": 3.8,
    "p99": 6.4,
    "max": 12.1
  },
  "io": {
    "reads": 3,
    "writes": 1,
    "bytesRead": 18640,
    "bytesWritten": 624
  },
  "gc": [
    { "type": "scavenge", "durationMs": 2.1 },
    { "type": "mark-sweep-compact", "durationMs": 2.2 }
  ]
}
```

**Quick Examples:**

```bash
# Get performance summary
npx nextforge doctor --profile

# Save metrics to file
npx nextforge add:page about --metrics json > .nextforge/last.json

# View I/O stats
npx nextforge add:page reports --metrics json | jq '.io'

# Check step timings
npx nextforge add:page dashboard --metrics json | jq '.steps'

# Compare commands
for cmd in doctor "add:page test" "add:component Button"; do
  echo -n "$cmd: "
  npx nextforge $cmd --metrics json 2>/dev/null | jq -r '.wallMs + "ms"'
done

# Monitor memory across runs
npx nextforge add:page users --metrics json | jq '.memory | {peak: .peakMB, delta: (.endMB - .startMB)}'
```

**Profiling Overhead:**

The profiling system adds minimal overhead (typically < 5ms) when enabled. Event loop and GC monitoring are only active when `--profile` or `NEXTFORGE_PROFILE=1` is set.

### Distributed Tracing

NextForge includes built-in distributed tracing to correlate logs across command execution and visualize operation hierarchies.

**Features:**

- **Trace IDs** - Correlate all logs from a single command execution
- **Span IDs** - Track individual operations within a command
- **Duration measurements** - Performance analysis for each operation
- **Hierarchical span trees** - Visual representation of operation nesting

**View Trace Trees:**

```bash
# Show trace tree after command execution
nextforge doctor --trace

# Output:
Trace:
command:doctor (7.29 ms)
```

For complex operations with nested spans:

```bash
nextforge add:component Button --trace

# Output:
Trace:
command:add:component (45.2 ms)
  step:loadConfig (12.3 ms)
  step:writeFiles (28.1 ms)
    write:Button.tsx (15.4 ms)
    write:index.ts (8.2 ms)
```

**Custom Trace IDs:**

```bash
# Set a custom trace ID for correlation across logs
NEXTFORGE_TRACE_ID=my-custom-id nextforge doctor

# All logs will include: "traceId": "my-custom-id"
```

**Combine with Profiling:**

```bash
# Get both trace tree and performance metrics
nextforge add:page Dashboard --trace --profile
```

See **[docs/tracing.md](docs/tracing.md)** for complete documentation.

### Component Generation

```bash
# Override config with CLI flag
nextforge add:component Button --framework chakra

# Override config with environment variable
NEXTFORGE_USE_TAILWIND=false nextforge add:component Card

# Use config default (no flag or env var)
nextforge add:component Badge
```

#### Shell Compatibility

**zsh users:** Quote arguments containing brackets to prevent shell globbing:

```bash
# ✅ Correct (quoted)
nextforge add:page "blog/[slug]"
nextforge add:page "docs/[...parts]"
nextforge add:group auth --pages "signin,signup,[id]"

# ❌ Incorrect (unquoted - zsh will expand brackets)
nextforge add:page blog/[slug]
nextforge add:page docs/[...parts]
```

If you frequently use dynamic routes, add this to your `~/.zshrc` to disable bracket expansion:

```bash
setopt no_nomatch
```

The `doctor` command will detect zsh and provide guidance if needed.

### Component Generation

Scaffold reusable components under `<app>/components/<group>/<Name>`. Components are automatically placed in the correct directory based on their group type and include proper TypeScript types, client/server directives, and framework-specific templates.

```bash
# Basic UI component (default group is "ui")
nextforge add:component Button --group ui

# Layout component (accepts children)
nextforge add:component Shell --group layout

# Nested sections
nextforge add:component marketing/Hero --group section

# Feature component with tests, styles, and client directive
nextforge add:component Auth --group feature --with-tests --with-style --client

# Override framework per-run
nextforge add:component Hero --group section --framework chakra
nextforge add:component Card --group ui --framework tailwind
nextforge add:component Shell --group layout --framework both

# Tailwind: CSS modules skipped (use utility classes)
nextforge add:component Badge --group ui --with-style

# Chakra: Creates .styles.ts file
nextforge add:component Card --group ui --with-style

# Basic (no framework): Creates .module.css file
nextforge add:component Badge --group ui --with-style

# Overwrite existing files
nextforge add:component Button --group ui --force
```

#### Component Groups

Components are organized into four groups, each placed in a specific directory:

- **`ui`** (default) → `components/ui/` - Reusable UI components (buttons, cards, inputs)
- **`layout`** → `components/layout/` - Layout components that accept children
- **`section`** → `components/section/` - Page sections and content blocks
- **`feature`** → `components/feature/` - Feature-specific components (includes a custom hook)

#### Component Options

- `--group <type>` - Component group: `ui` | `layout` | `section` | `feature` (default: `ui`)
- `--app <dir>` - App directory (default: `app`)
- `--framework <name>` - Override template: `chakra` | `tailwind` | `basic` | `both` (takes precedence over `nextforge.config.json`)
- `--client` - Add `"use client"` directive for client components (default: server component)
- `--with-tests` - Create a Vitest test file (`Component.test.tsx`)
- `--with-style` - Create a style file (`.styles.ts` for Chakra, `.module.css` for basic, skipped for Tailwind)
- `--with-story` - Create a Storybook story file (`Component.stories.tsx`)
- `--force` - Overwrite existing files

#### Client vs Server Components

By default, components are created as **server components** (no `"use client"` directive). Use the `--client` flag to create client components:

```bash
# Server component (default)
nextforge add:component Button --group ui

# Client component
nextforge add:component Counter --group ui --client
```

The generated component will include the `"use client"` directive at the top when `--client` is used:

```tsx
"use client";

import React from "react";

export interface CounterProps {
  title?: string;
  subtitle?: string;
}

export default function Counter({ title, subtitle }: CounterProps) {
  return (
    <div>
      {title && <h2>{title}</h2>}
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}
```

#### Framework Selection

The framework template is chosen based on this precedence:

1. **`--framework` flag** (highest precedence) - Explicitly override template
2. **`nextforge.config.json`** - Project-wide configuration
3. **Default** - Basic template if no framework detected

**Examples:**

```bash
# Override config to use Tailwind
nextforge add:component Button --group ui --framework tailwind

# Use Chakra with client directive and tests
nextforge add:component Counter --group ui --framework chakra --client --with-tests

# Both frameworks (Chakra + Tailwind utilities)
nextforge add:component Hybrid --group ui --framework both
```

**Note:** When `--framework tailwind` or `useTailwind: true` is active, `--with-style` skips CSS module creation. Use Tailwind utility classes instead.

#### Style File Generation

The `--with-style` flag behavior depends on your framework configuration:

- **Chakra enabled** → Creates `.styles.ts` with `SystemStyleObject` definitions
- **Tailwind enabled** → Skips CSS module creation (use utility classes instead)
- **Basic (no framework)** → Creates `.module.css` with CSS module styles

```bash
# Chakra style file
nextforge add:component Card --group ui --with-style
# → Creates: Card.styles.ts

# Tailwind (skipped)
nextforge add:component Badge --group ui --with-style
# → No CSS file created (use Tailwind utilities)

# Basic CSS module
nextforge add:component Badge --group ui --with-style
# → Creates: Badge.module.css
```

#### Generated Templates

Components adapt to your framework configuration (detected from `nextforge.config.json`):

**Tailwind Component:**

```tsx
import React from "react";

export interface ButtonProps {
  title?: string;
  subtitle?: string;
}

export default function Button({ title, subtitle }: ButtonProps) {
  return (
    <section className="p-6">
      <h2 className="text-xl font-semibold">Button</h2>
      {title ? <p className="mt-2 text-gray-600">{title}</p> : null}
    </section>
  );
}
```

**Chakra Component:**

```tsx
import React from "react";
import { Box, Heading, Text } from "@chakra-ui/react";

export interface ButtonProps {
  title?: string;
  subtitle?: string;
}

export default function Button({ title, subtitle }: ButtonProps) {
  return (
    <Box py={6}>
      <Heading size="md">Button</Heading>
      {title ? <Text mt={2}>{title}</Text> : null}
    </Box>
  );
}
```

**Layout Component (accepts children):**

```tsx
import React, { type ReactNode } from "react";

export interface ShellProps {
  children: ReactNode;
}

export default function Shell({ children }: ShellProps) {
  return <div className="container mx-auto px-4">{children}</div>;
}
```

#### Manifest File

NextForge maintains a `.nextforge/manifest.json` file that tracks all generated components. This file is automatically updated when components are created and uses atomic writes to prevent corruption during concurrent runs.

**Manifest Structure:**

The manifest stores component **names** (not paths) grouped by component type:

```json
{
  "components": {
    "ui": ["Button", "Card", "Input"],
    "layout": ["Shell", "Container"],
    "section": ["Hero", "Features"],
    "feature": ["Auth", "Dashboard"]
  }
}
```

**Design Decision:** The manifest uses component names per group rather than full paths. This keeps the manifest simple for UI menus and component listings, but means components with the same name in different subfolders will appear as duplicates. If you need globally unique tracking, use the actual file system structure or external tooling.

#### Barrel Exports

Components are automatically exported from barrel files (`components/<group>/index.ts`) for convenient imports:

```tsx
import { Button, Card } from "@/components/ui";
```

#### Page Generation Options

- `-g, --group <name>` - Target route group (e.g. 'auth' or '(auth)')
- `--async` - Generate an async server component
- `--client` - Generate a client component
- `--layout` - Create a minimal layout.tsx in the leaf directory
- `--loading` - Create loading.tsx in the leaf directory
- `--error` - Create error.tsx in the leaf directory
- `--api` - Create a route.ts API handler
- `--skip-page` - Do not create page.tsx (useful for pure API routes)
- `--force` - Overwrite existing files

#### Smart Features

- **API Auto-Detection**: Routes starting with `api/` automatically skip page creation
- **Route Group Conflict Detection**: Prevents double grouping like `(auth)/profile` with `--group auth`
- **Intelligent Title Generation**: Handles camelCase (`userProfile` → `User Profile`) and dynamic segments
- **Context-Aware Documentation**: Different README templates for pages vs API routes
- **Accurate File Tracking**: Only shows files that were actually created

#### Supported Route Patterns

- **Static segments**: `about`, `dashboard`, `settings`
- **Dynamic segments**: `[slug]`, `[id]`, `[category]`
- **Catch-all routes**: `[...slug]`, `[...rest]`
- **Optional catch-all**: `[[...slug]]`, `[[...maybe]]`
- **Nested segments**: `admin/settings`, `users/profile`
- **Route groups**: `(auth)/signin`, `(dashboard)/overview`

#### Generated Templates

**Server Component (Default):**

```tsx
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Page Title" };

export default function Page() {
  return (
    <section className="p-8">
      <h1 className="text-2xl font-semibold">Page Title</h1>
      <p className="mt-2 text-gray-600">Synchronous page generated by NextForge.</p>
    </section>
  );
}
```

**Async Server Component:**

```tsx
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Page Title" };

export default async function Page() {
  const res = await fetch("https://jsonplaceholder.typicode.com/todos/1", { cache: "no-store" });
  const data = await res.json();
  return (
    <section className="p-8">
      <h1 className="text-2xl font-semibold">Page Title (async)</h1>
      <pre className="mt-3 text-xs bg-gray-100 p-3 rounded-lg overflow-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </section>
  );
}
```

**Client Component:**

```tsx
"use client";

import { useState } from "react";

export default function Page() {
  const [count, setCount] = useState(0);
  return (
    <section className="p-8">
      <h1 className="text-2xl font-semibold">Page Title (client)</h1>
      <button
        className="mt-3 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        onClick={() => setCount((c) => c + 1)}
      >
        Count: {count}
      </button>
    </section>
  );
}
```

**API Route Handler:**

```tsx
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  return Response.json({ ok: true, route: "/api/users" });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return Response.json({ ok: true, received: body }, { status: 201 });
}
```

#### Error Handling & Validation

The `add:page` command includes comprehensive error handling:

- **Unsupported Route Types**: Clear error messages for parallel routes (`@slot`) and intercepting routes (`(..segment)`)
- **Route Group Conflicts**: Prevents double grouping and provides helpful guidance
- **File Existence**: Shows "Nothing created" when all targets already exist
- **Input Validation**: Trims whitespace and validates route segments
- **Shell Compatibility**: Provides quoting guidance for shells like zsh

**Example Error Messages:**

```bash
# Unsupported features
nextforge add:page "@modal"
# Error: Parallel routes (@slot) and intercepting routes (..segment) are not supported by this command yet.

# Nothing to create
nextforge add:page "api/users" --api
# Output: Nothing created. All targets already exist. Use --force to overwrite.
```

### Route Group Generation

Create Next.js App Router route groups with optional child pages:

```bash
# Basic route group
nextforge add:group auth

# With layout and child pages
nextforge add:group auth --with-layout --pages signin,signup,reset

# Custom app directory
nextforge add:group dashboard --app apps/web/app --pages overview,settings

# Skip README generation
nextforge add:group marketing --no-readme --pages landing,about

# Overwrite existing files
nextforge add:group auth --force --with-layout --pages signin,signup

# Complex nested segments
nextforge add:group admin --pages "users,[slug],settings/notifications"
```

#### Route Group Options

- `--app <dir>` - App directory (default: "app")
- `--with-layout` - Create layout.tsx in the group
- `--no-readme` - Skip creating a README.md
- `--force` - Overwrite existing files
- `--pages <list>` - Comma-separated child segments to seed

#### Supported Segment Patterns

- **Static segments**: `signin`, `dashboard`, `settings`
- **Dynamic segments**: `[slug]`, `[id]`, `[category]`
- **Catch-all routes**: `[...slug]`, `[...rest]`
- **Optional catch-all**: `[[...slug]]`, `[[...maybe]]`
- **Nested segments**: `admin/settings`, `users/profile`

#### Security Features

- **Path traversal protection**: Blocks `..` and `.` segments
- **Input sanitization**: Trims spaces and removes leading/trailing slashes
- **Deduplication**: Prevents duplicate segments
- **Validation**: Regex patterns ensure only valid Next.js route segments

#### Generated Files

The `add:group` command creates:

```
app/(auth)/
├── README.md              # Route group documentation
├── layout.tsx             # Optional group layout (--with-layout)
├── signin/
│   └── page.tsx          # Generated page component
├── signup/
│   └── page.tsx          # Generated page component
└── [slug]/
    └── page.tsx          # Dynamic route page
```

**Generated Layout Template:**

```tsx
import React, { type ReactNode } from "react";

export default function GroupLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
```

**Generated Page Template:**

```tsx
import React from "react";

export default async function Page() {
  return (
    <section className="p-8">
      <h1 className="text-2xl font-semibold">Page Title</h1>
    </section>
  );
}
```

### Add Cursor

Generate Cursor AI rule files and phase prompts to guide AI-assisted development. Files are created in JSON format by default, with optional MDX output.

```bash
# Create a rules file (JSON format by default)
npx nextforge add:cursor rules --name audit-trace

# Create rules in MDX format
npx nextforge add:cursor rules --name perf-budget --mdx

# Create phase prompts for implementation tracking
npx nextforge add:cursor phase --phase 1

# Multiple phases for complex features
npx nextforge add:cursor phase --phase 2 --mdx

# Custom output directory (overrides config)
npx nextforge add:cursor rules --name security --cursor-dir .cursor/custom

# Overwrite existing files
npx nextforge add:cursor rules --name api-design --force
```

#### Directory Precedence

The output directory is determined by the following precedence:

1. `--cursor-dir` CLI flag (highest priority)
2. `config.cursorDir` from `nextforge.config.{json,ts}`
3. `.nextforge/cursor` (default)

#### File Types

- **`rules`** → Creates `<cursorDir>/rules/<name>.rules.{json,mdx}` - Define rules and conventions for specific development areas
- **`phase`** → Creates `<cursorDir>/phases/phase-<n>.{json,mdx}` - Track multi-phase implementation steps

#### Format Options

- **JSON** (default): Structured data format, ideal for programmatic access
- **MDX** (with `--mdx` flag): Markdown with frontmatter, ideal for documentation and human readability

#### Generated Files

**Rules File (`.nextforge/cursor/rules/component.rules.md`):**

```markdown
# Cursor Rules — component

## Purpose

Define rules and conventions for component to guide Cursor AI during development.

## Cursor Setup

Add this file to your Cursor rules:

1. Open Cursor Settings
2. Navigate to Rules
3. Add `.nextforge/cursor/rules/component.rules.md`

## Example Prompt

\`\`\`yaml
task: implement component
context:

- Use NextForge conventions
- Follow TypeScript best practices
- Include tests
  \`\`\`
```

**Phase File (`.nextforge/cursor/phases/phase-1.md`):**

```markdown
# Phase 1

## Goal

Complete Phase 1 of the NextForge implementation.

## Steps

1. Review the requirements for this phase
2. Implement the necessary changes
3. Run tests to verify correctness
4. Update documentation

## Cursor Prompt Example

\`\`\`
Implement Phase 1 for NextForge:

Tasks:

- [ ] Scaffold required files
- [ ] Add necessary configuration
- [ ] Write integration tests
      \`\`\`
```

## Development

This project uses:

- **TypeScript** for type safety
- **Commander.js** for CLI argument parsing
- **Vitest** for testing
- **ESLint** and **Prettier** for code quality
- **ESM-only** modules (Node 18.18.0+)
- **pnpm** for package management

### Quick Start for Contributors

> 📖 **Contributing?** See the [Contributor Guide](docs/FOR_AI.md) for detailed editing guidelines, file structure conventions, and development patterns.

```bash
# Install dependencies
pnpm install

# Build the project
pnpm build

# Type check
pnpm typecheck

# Run linter
pnpm lint

# Run tests
pnpm test -- --run

# Run smoke tests
pnpm smoke

# Format code
pnpm format

# Run all verification checks
pnpm verify
```

### Setup

```bash
# Install dependencies
npm install
# or
pnpm install

# Run all checks (recommended)
npm run verify
# or
pnpm verify

# Or run individual commands
npm run build    # Build the project
npm test         # Run tests (watch mode)
npm run test:run # Run tests once
npm run lint     # Run linting
npm run format   # Format code
npm run smoke    # Run smoke tests
```

### Local Development

```bash
# Install dependencies
npm i

# Build the project
npm run build

# Test the CLI
node bin/nextforge.js --help
node bin/nextforge.js doctor

# Development mode (requires tsx)
npm run dev

# Run CLI after build
npm run cli -- --help
```

### Project Structure

```
src/
├── index.ts                    # Main CLI entry point
├── commands/
│   ├── doctor.ts              # Doctor command implementation
│   └── add/
│       ├── component.ts       # Component generator
│       ├── group.ts           # Route group generator
│       └── page.ts            # Page and API route generator
├── build-smoke.test.ts        # Build verification test
└── scripts/
    ├── zip-pr-diff.mjs        # PR diff zipper utility
    └── README-zip-pr-diff.md  # Zipper documentation
```

### Development Commands

```bash
# Run all quality checks
npm run verify

# Development with hot reload
npm run dev

# Build and test
npm run build && npm test

# Format and lint
npm run format && npm run lint:fix
```

### Git Hooks

This project uses **Husky** to ensure code quality before commits and pushes:

- **Pre-commit hook**: Runs `npm run verify` before each commit
- **Pre-push hook**: Runs `npm run verify` before pushing to GitHub

The hooks will prevent commits/pushes if:

- ESLint finds any issues
- Prettier formatting is incorrect
- TypeScript compilation fails
- Tests fail
- CLI smoke tests fail

To bypass hooks (not recommended):

```bash
git commit --no-verify -m "message"
git push --no-verify
```

### Utility Scripts

```bash
# Create PR diff zip
npm run zip:pr

# Test specific commit range
npm run zip:pr -- --base HEAD~5 --head HEAD

# Since last tag
npm run zip:pr -- --since $(git describe --tags --abbrev=0)
```

## Technical Specifications

### Runtime Requirements

- **Node.js** >= 18.18.0
- **ESM-only** modules (no CommonJS)
- **TypeScript** 5.3+ for development

### Build Output

- **ES2022** target with NodeNext module resolution
- **TypeScript declarations** (`.d.ts` files)
- **Source maps** for debugging
- **Tree-shakeable** exports

### Code Quality

- **ESLint** with TypeScript rules
- **Prettier** formatting (100 char width)
- **Import sorting** and organization
- **Consistent naming** conventions

### Testing & CI

- **Vitest** for unit testing
- **GitHub Actions** CI/CD
- **Multi-Node** testing (18.x, 20.x)
- **Build verification** with smoke tests

## Requirements

- Node.js >= 18.18.0
- ESM-only modules

## Uninstall

To remove NextForge from your project:

### 1. Remove the package

```bash
# If installed globally
npm uninstall -g @forged/nextforge

# If installed as dev dependency
npm uninstall -D @forged/nextforge
# or
pnpm remove -D @forged/nextforge
```

### 2. Clean up generated files (optional)

NextForge creates files in your project. To remove them:

```bash
# Remove generated NextForge files
rm -rf .nextforge/

# Remove config file (if you created one)
rm nextforge.config.ts
# or
rm nextforge.config.js
# or
rm nextforge.config.json

# Remove generated components (review before deleting!)
# Components are in: app/components/{ui,layout,section,feature}/
# Review and manually delete only NextForge-generated components

# Remove generated pages (review before deleting!)
# Pages are under your app directory
# Review and manually delete only NextForge-generated pages
```

**Note:** NextForge does not track which specific files it created after generation, so manually review components and pages before deletion. The `.nextforge/manifest.json` file lists component names but not full paths.

### 3. Revert git changes (optional)

If you want to undo all NextForge changes:

```bash
# View NextForge-related commits
git log --grep="NextForge" --grep="nextforge" -i --oneline

# Revert specific commits
git revert <commit-hash>

# Or reset to before NextForge (⚠️ destructive!)
git reset --hard <commit-before-nextforge>
```

## License

This project is licensed under the MIT License - see the [LICENSE](docs/LICENSE) file for details.
