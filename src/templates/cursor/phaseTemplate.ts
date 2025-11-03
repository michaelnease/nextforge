export function phaseTemplate(phase: number): string {
  return `# Phase ${phase}

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

Flags to consider:
--app <dir>     Specify app directory
--force         Overwrite existing files
--verbose       Enable detailed logging
\`\`\`

## Validation

- [ ] All tests pass
- [ ] Build completes without errors
- [ ] Generated files follow conventions
- [ ] Documentation is updated
`;
}
