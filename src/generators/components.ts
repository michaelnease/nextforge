type FW = { isBasic: boolean; isTailwind: boolean; isChakra: boolean; isBoth: boolean };

export function makeComponentSource(args: {
  name: string;
  group: string;
  fw: FW;
  addClient: boolean;
}): string {
  const { name, group, fw, addClient } = args;

  const client = addClient ? '"use client";\n\n' : "";
  const isLayout = group === "layout";

  // BASIC
  if (fw.isBasic) {
    if (isLayout) {
      return `${client}import type { ReactNode } from "react";

export default function ${name}({ children }: { children: ReactNode }) {
  return <div data-testid="${name}">{children}</div>;
}
`;
    }
    return `${client}export default function ${name}() {
  return <div data-testid="${name}">${name}</div>;
}
`;
  }

  // TAILWIND
  if (fw.isTailwind) {
    if (isLayout) {
      return `${client}import type { ReactNode } from "react";

export default function ${name}({ children }: { children: ReactNode }) {
  return <div className="p-6" data-testid="${name}">{children}</div>;
}
`;
    }
    return `${client}export default function ${name}() {
  return <div className="p-6" data-testid="${name}">${name}</div>;
}
`;
  }

  // CHAKRA
  if (fw.isChakra) {
    if (isLayout) {
      return `${client}import type { ReactNode } from "react";
import { Container } from "@chakra-ui/react";

export function ${name}({ children }: { children: ReactNode }) {
  return <Container data-testid="${name}">{children}</Container>;
}

export default ${name};
`;
    }
    return `${client}import { Box, Heading, Text } from "@chakra-ui/react";

export function ${name}() {
  return <Box data-testid="${name}">${name}</Box>;
}

export default ${name};
`;
  }

  // BOTH (hybrid)
  // must include chakra import + className to satisfy tests
  if (isLayout) {
    return `${client}import type { ReactNode } from "react";
import { Container } from "@chakra-ui/react";

export function ${name}({ children }: { children: ReactNode }) {
  return <Container className="p-6" data-testid="${name}">{children}</Container>;
}

export default ${name};
`;
  }
  return `${client}import { Box, Heading, Text } from "@chakra-ui/react";

export function ${name}() {
  return <Box className="p-6" data-testid="${name}">${name}</Box>;
}

export default ${name};
`;
}

export function makeChakraStylesSource(name: string): string {
  // tests expect SystemStyleObject and a symbol containing the component name (e.g., CardStyles)
  return `import type { SystemStyleObject } from "@chakra-ui/react";

export const ${name}Styles: SystemStyleObject = {
  // Add your styles here
};
`;
}

export function makeTestSource(name: string): string {
  return `import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import ${name} from "./${name}";

describe("${name}", () => {
  it("renders without crashing", () => {
    render(<${name} />);
    expect(screen.getByTestId("${name}")).toBeInTheDocument();
  });
});
`;
}
