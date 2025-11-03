type PhaseTemplateInput = {
  phase: number;
  format: "mdx" | "json";
};

export function phaseTemplate({ phase, format }: PhaseTemplateInput): string {
  if (format === "json") {
    return (
      JSON.stringify(
        {
          $schema: "https://cursor.directory/schema.json",
          phase,
          title: `Phase ${phase}`,
          goal: `Complete Phase ${phase} of the NextForge implementation`,
          steps: [
            "Review the requirements for this phase",
            "Implement the necessary changes",
            "Run tests to verify correctness",
            "Update documentation",
          ],
          validation: [
            "All tests pass",
            "Build completes without errors",
            "Generated files follow conventions",
            "Documentation is updated",
          ],
        },
        null,
        2
      ) + "\n"
    );
  }

  // MDX format
  return `---
phase: ${phase}
title: Phase ${phase}
---

# Phase ${phase}

## Goal

Complete Phase ${phase} of the NextForge implementation.

## Steps

1. Review the requirements for this phase
2. Implement the necessary changes
3. Run tests to verify correctness
4. Update documentation

## Cursor Prompt Example

\`\`\`
Implement Phase ${phase} for NextForge:

Context:
- Working in a Next.js + TypeScript project
- Using NextForge CLI conventions
- Target: app directory structure

Tasks:
- [ ] Scaffold required files
- [ ] Add necessary configuration
- [ ] Write integration tests
- [ ] Verify build passes

Available flags:
--force         Overwrite existing files
\`\`\`

## Validation

- [ ] All tests pass
- [ ] Build completes without errors
- [ ] Generated files follow conventions
- [ ] Documentation is updated
`;
}
