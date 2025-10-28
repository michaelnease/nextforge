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
- **PR diff zipper** for change tracking
- **Build verification** with smoke tests
- **Package validation** with npm pack checks

### 🚀 **Developer Experience**

- **One-command verification** (`npm run verify`)
- **Hot reload development** (`npm run dev`)
- **Automatic formatting** and linting
- **Comprehensive error handling**

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
├── index.ts              # Main CLI entry point
├── commands/
│   └── doctor.ts         # Doctor command implementation
└── build-smoke.test.ts   # Build verification test
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
