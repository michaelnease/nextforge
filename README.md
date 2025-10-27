# @forged/nextforge

A CLI tool for Next.js project scaffolding and management.

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
- **ESM-only** modules (Node 18+)

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

### Project Structure

```
src/
├── index.ts              # Main CLI entry point
└── commands/
    └── doctor.ts         # Doctor command implementation
```

## License

MIT
