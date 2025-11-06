/**
 * Generate CSS module template
 */
export function cssModuleTemplate(): string {
  return `.container {
  /* Add your styles here */
}
`;
}

/**
 * Generate Storybook story template
 */
export function storyTemplate(name: string, group: string): string {
  return `import type { Meta, StoryObj } from "@storybook/react";
import ${name} from "./${name}";

const meta = {
  title: "components/${group}/${name}",
  component: ${name},
} satisfies Meta<typeof ${name}>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};
`;
}
