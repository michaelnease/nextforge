/**
 * Component template generator.
 */
export interface ComponentTemplateOptions {
  name: string;
  useTailwind?: boolean;
  useChakra?: boolean;
  framework?: "react" | "next";
  group?: "ui" | "layout" | "section" | "feature";
  client?: boolean;
}

/**
 * Generate component template based on framework preferences.
 */
export function componentTemplate({
  name,
  useTailwind,
  useChakra,
  group,
  client,
}: ComponentTemplateOptions): string {
  const clientHeader = client ? '"use client";\n\n' : "";
  const propsName = `${name}Props`;

  // Layout components always accept children
  const isLayout = group === "layout";
  const propsInterface = isLayout
    ? `export interface ${propsName} {
  children: ReactNode;
}`
    : `export interface ${propsName} {
  title?: string;
  subtitle?: string;
}`;

  // Both frameworks (Chakra + Tailwind)
  if (useChakra && useTailwind) {
    if (isLayout) {
      return `${clientHeader}import React, { type ReactNode } from "react";
import { Container } from "@chakra-ui/react";

${propsInterface}

export function ${name}({ children }: ${propsName}) {
  return <Container maxW="6xl" py={6} className="container mx-auto px-4">{children}</Container>;
}

export default ${name};
`;
    }
    return `${clientHeader}import React from "react";
import { Box, Heading, Text } from "@chakra-ui/react";

${propsInterface}

export function ${name}({ title, subtitle }: ${propsName}) {
  return (
    <Box py={6} className="p-6">
      <Heading size="md" className="text-xl font-semibold">${name}</Heading>
      {title ? <Text mt={2} className="text-gray-600">{title}</Text> : null}
      {subtitle ? <Text color="gray.500" className="text-gray-500">{subtitle}</Text> : null}
    </Box>
  );
}

export default ${name};
`;
  }

  // Chakra only
  if (useChakra) {
    if (isLayout) {
      return `${clientHeader}import React, { type ReactNode } from "react";
import { Container } from "@chakra-ui/react";

${propsInterface}

export function ${name}({ children }: ${propsName}) {
  return <Container maxW="6xl" py={6}>{children}</Container>;
}

export default ${name};
`;
    }
    return `${clientHeader}import React from "react";
import { Box, Heading, Text } from "@chakra-ui/react";

${propsInterface}

export function ${name}({ title, subtitle }: ${propsName}) {
  return (
    <Box py={6}>
      <Heading size="md">${name}</Heading>
      {title ? <Text mt={2}>{title}</Text> : null}
      {subtitle ? <Text color="gray.500">{subtitle}</Text> : null}
    </Box>
  );
}

export default ${name};
`;
  }

  // Tailwind only
  if (useTailwind) {
    if (isLayout) {
      return `${clientHeader}import React, { type ReactNode } from "react";

${propsInterface}

export function ${name}({ children }: ${propsName}) {
  return <div className="container mx-auto px-4">{children}</div>;
}

export default ${name};
`;
    }
    return `${clientHeader}import React from "react";

${propsInterface}

export function ${name}({ title, subtitle }: ${propsName}) {
  return (
    <section className="p-6">
      <h2 className="text-xl font-semibold">${name}</h2>
      {title ? <p className="mt-2 text-gray-600">{title}</p> : null}
      {subtitle ? <p className="text-gray-500">{subtitle}</p> : null}
    </section>
  );
}

export default ${name};
`;
  }

  // Plain template (basic)
  if (isLayout) {
    return `${clientHeader}import React, { type ReactNode } from "react";

${propsInterface}

export function ${name}({ children }: ${propsName}) {
  return <div>{children}</div>;
}

export default ${name};
`;
  }
  return `${clientHeader}import React from "react";

${propsInterface}

export function ${name}({ title, subtitle }: ${propsName}) {
  return (
    <section>
      <h2>${name}</h2>
      {title ? <p>{title}</p> : null}
      {subtitle ? <p>{subtitle}</p> : null}
    </section>
  );
}

export default ${name};
`;
}

/**
 * Page template generator.
 */
export interface PageTemplateOptions {
  async?: boolean;
  client?: boolean;
}

/**
 * Generate page template based on async/client flags.
 */
export function pageTemplate({ async, client }: PageTemplateOptions): string {
  if (client) {
    return `"use client";

export default function Page() {
  return <div>Page</div>;
}
`;
  }

  if (async) {
    return `export default async function Page() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  return <div>Page</div>;
}
`;
  }

  // Sync server component
  return `export default function Page() {
  return <div>Page</div>;
}
`;
}
