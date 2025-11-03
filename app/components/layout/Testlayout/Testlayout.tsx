import React, { type ReactNode } from "react";

export interface TestlayoutProps {
  children: ReactNode;
}

export default function Testlayout({ children }: TestlayoutProps) {
  return <div className="container mx-auto px-4">{children}</div>;
}
