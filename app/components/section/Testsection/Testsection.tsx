import React from "react";

export interface TestsectionProps {
  title?: string;
  subtitle?: string;
}

export default function Testsection({ title, subtitle }: TestsectionProps) {
  return (
    <section className="p-6">
      <h2 className="text-xl font-semibold">Testsection</h2>
      {title ? <p className="mt-2 text-gray-600">{title}</p> : null}
      {subtitle ? <p className="text-gray-500">{subtitle}</p> : null}
    </section>
  );
}
