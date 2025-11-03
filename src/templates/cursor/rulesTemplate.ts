type RulesTemplateInput = {
  name: string;
  format: "mdx" | "json";
};

export function rulesTemplate({ name, format }: RulesTemplateInput): string {
  if (format === "json") {
    return (
      JSON.stringify(
        {
          $schema: "https://cursor.directory/schema.json",
          name,
          description: `Cursor AI rules for ${name}`,
          guidelines: [],
          conventions: [],
          examples: [],
        },
        null,
        2
      ) + "\n"
    );
  }

  // MDX format
  return `---
name: ${name}
description: Cursor AI rules for ${name}
---

# Cursor Rules — ${name}

## Purpose

Define rules and conventions for ${name} to guide Cursor AI during development.

## Cursor Setup

Add this file to your Cursor rules:
1. Open Cursor Settings
2. Navigate to Rules
3. Add \`.nextforge/cursor/rules/${name}.rules.mdx\`

## Guidelines

- Follow existing code patterns
- Use ESM imports
- Add JSDoc comments for public APIs
- Write tests alongside implementation

## Conventions

- Use TypeScript for type safety
- Follow NextForge project structure
- Include comprehensive error handling
- Document complex logic

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
`;
}
