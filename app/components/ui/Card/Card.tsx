import React from "react";
import { Box, Heading, Text } from "@chakra-ui/react";

export interface CardProps {
  title?: string;
  subtitle?: string;
}

export default function Card({ title, subtitle }: CardProps) {
  return (
    <Box py={6}>
      <Heading size="md">Card</Heading>
      {title ? <Text mt={2}>{title}</Text> : null}
      {subtitle ? <Text color="gray.500">{subtitle}</Text> : null}
    </Box>
  );
}
