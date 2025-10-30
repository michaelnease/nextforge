## NextForge - Editing Guide for AI

- Commands live under `src/commands/**`.
- Register all commands inside the anchor block `[nextforge.register:commands]` in `src/index.ts`:
  - Start: `// [nextforge.register:commands:start]`
  - End: `// [nextforge.register:commands:end]`
- Component/page template anchors (for consistent edits) exist in `src/commands/add/group.ts`:
  - Layout: `[nextforge.templates:layout]`
  - Tailwind page: `[nextforge.templates:page.tailwind]`
  - Basic page: `[nextforge.templates:page.basic]`
  - Chakra page: `[nextforge.templates:page.chakra]`
- Config is loaded with `loadConfig` and merged via `mergeConfig`.
- Precedence: CLI flags → env → config file → defaults.
- Do not edit outside anchor blocks unless explicitly instructed.
