"use client";

import React, { type ReactNode } from "react";

export interface ShellProps {
  children: ReactNode;
}

export default function Shell({ children }: ShellProps) {
  return <div className="container mx-auto px-4">{children}</div>;
}
