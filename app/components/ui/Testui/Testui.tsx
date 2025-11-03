import React from "react";

export interface TestuiProps {
  title?: string;
  subtitle?: string;
}

export default function Testui({ title, subtitle }: TestuiProps) {
  return (
    <section className="p-6">
      <h2 className="text-xl font-semibold">Testui</h2>
      {title ? <p className="mt-2 text-gray-600">{title}</p> : null}
      {subtitle ? <p className="text-gray-500">{subtitle}</p> : null}
    </section>
  );
}
