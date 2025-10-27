# @forged/nextforge

A CLI tool for Next.js project scaffolding and management.

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

```bash
# Show help
nextforge --help

# Show version
nextforge --version

# Run diagnostic checks
nextforge doctor
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

# Build the project
npm run build

# Run tests
npm test

# Run linting
npm run lint

# Format code
npm run format
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

## Requirements

- Node.js >= 18.18.0
- ESM-only modules

## License

MIT
