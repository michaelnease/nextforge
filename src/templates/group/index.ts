/**
 * Generate layout template for route group
 */
export function layoutTemplate(): string {
  return `import React, { type ReactNode } from "react";

export default function GroupLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
`;
}

/**
 * Generate README template for route group
 */
export function readmeTemplate(groupLabel: string): string {
  return `# ${groupLabel} route group

This is a Next.js **route group**. The folder name is wrapped in parentheses so it does **not** affect the URL path.
Use this folder to organize segments like auth flows, marketing sections, experiments, or feature areas.

- Add child segments under this folder, e.g. \`(auth)/signin/page.tsx\`
- Optional \`layout.tsx\` here will wrap all child routes under the group.
`;
}
