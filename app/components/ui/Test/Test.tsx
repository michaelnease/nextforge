import React from "react";
import { Box, Heading, Text } from "@chakra-ui/react";

export interface TestProps {
  title?: string;
  subtitle?: string;
}

export default function Test({ title, subtitle }: TestProps) {
  return (
    <Box py={6}>
      <Heading size="md">Test</Heading>
      {title ? <Text mt={2}>{title}</Text> : null}
      {subtitle ? <Text color="gray.500">{subtitle}</Text> : null}
    </Box>
  );
}
