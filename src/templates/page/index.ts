/**
 * Generate page template based on client/async flags and dynamic route segment.
 */
export function generatePageTemplate(
  client: boolean,
  async: boolean,
  routeSegment?: string
): string {
  // For dynamic routes, extract param name from [slug] or [[...slug]]
  let content = "<div>page</div>";
  if (routeSegment) {
    const match = routeSegment.match(/\[+([^\]]+)\]+/);
    if (match && match[1]) {
      const paramName = match[1].replace("...", "");
      const capitalize = paramName.charAt(0).toUpperCase() + paramName.slice(1);
      content = `<div>${capitalize}</div>`;
    }
  }

  if (client) {
    return `"use client";

export default function Page() {
  return ${content};
}
`;
  }

  if (async) {
    return `export default async function Page() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  return ${content};
}
`;
  }

  // Sync server component
  return `export default function Page() {
  return ${content};
}
`;
}

/**
 * Generate layout template based on client flag.
 */
export function generateLayoutTemplate(client: boolean): string {
  const clientDirective = client ? '"use client";\n\n' : "";
  return `${clientDirective}export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
`;
}

/**
 * Generate API route template.
 */
export function generateApiRouteTemplate(): string {
  return `import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true });
}
`;
}

/**
 * Generate page test template.
 */
export function generatePageTestTemplate(route: string): string {
  return `import Page from "../page";
import { render, screen } from "@testing-library/react";

describe("page ${route}", () => {
  it("renders", () => {
    render(<Page />);
    expect(screen.getByText(/page/i)).toBeTruthy();
  });
});
`;
}
