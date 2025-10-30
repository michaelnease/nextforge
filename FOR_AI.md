## NextForge - Editing Guide for AI

- Commands live under `src/commands/**`.
- Register all commands inside the anchor block `[nextforge.register:commands]` in `src/index.ts`:
  - Start: `// [nextforge.register:commands:start]`
  - End: `// [nextforge.register:commands:end]`
- Component and page template anchors (for consistent edits) live in `src/commands/add/group.ts`:
  - Layout: `[nextforge.templates:layout:start]` … `[nextforge.templates:layout:end]`
  - Tailwind page: `[nextforge.templates:page.tailwind:start]` … `[nextforge.templates:page.tailwind:end]`
  - Basic page: `[nextforge.templates:page.basic:start]` … `[nextforge.templates:page.basic:end]`
  - Chakra page: `[nextforge.templates:page.chakra:start]` … `[nextforge.templates:page.chakra:end]`
- Config is loaded with `loadConfig` and merged via `mergeConfig`.
- Precedence: CLI flags → env → config file → defaults.
- Do not edit outside anchor blocks unless explicitly instructed.
