# @forged/nextforge

A modern CLI tool for Next.js project scaffolding and management, built with TypeScript and ESM.

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
- **Comprehensive CI/CD** with GitHub Actions

### 📦 **Built-in Utilities**

- **Doctor command** for project diagnostics
- **Route group generator** for Next.js App Router
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

### Utility Scripts

```bash
# Create PR diff zip
npm run zip:pr

# Test specific commit range
npm run zip:pr -- --base HEAD~5 --head HEAD

# Since last tag
npm run zip:pr -- --since $(git describe --tags --abbrev=0)
```

## Development

This project uses:

- **TypeScript** for type safety
- **Commander.js** for CLI argument parsing
- **Vitest** for testing
- **ESLint** and **Prettier** for code quality
- **ESM-only** modules (Node 18.18.0+)

### Setup

```bash
# Install dependencies
npm install

# Run all checks (recommended)
npm run verify

# Or run individual commands
npm run build    # Build the project
npm test         # Run tests
npm run lint     # Run linting
npm run format   # Format code
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
│       └── group.ts           # Route group generator
├── build-smoke.test.ts        # Build verification test
└── scripts/
    ├── zip-pr-diff.mjs        # PR diff zipper utility
    └── README-zip-pr-diff.md  # Zipper documentation
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

## License

MIT
