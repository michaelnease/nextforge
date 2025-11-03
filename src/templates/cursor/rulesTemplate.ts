export function rulesTemplate(name: string): string {
  return `# Cursor Rules — ${name}

## Purpose

Define rules and conventions for ${name} to guide Cursor AI during development.

## Cursor Setup

Add this file to your Cursor rules:
1. Open Cursor Settings
2. Navigate to Rules
3. Add \`.nextforge/cursor/rules/${name}.rules.md\`

## Example Prompt

\`\`\`yaml
task: implement ${name}
context:
  - Use NextForge conventions
  - Follow TypeScript best practices
  - Include tests
output:
  - Component implementation
  - Test coverage
  - Documentation
\`\`\`

## Conventions

- Follow existing code patterns
- Use ESM imports
- Add JSDoc comments for public APIs
- Write tests alongside implementation
`;
}
