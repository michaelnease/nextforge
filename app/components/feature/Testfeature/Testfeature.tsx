import React from "react";

export interface TestfeatureProps {
  title?: string;
  subtitle?: string;
}

export default function Testfeature({ title, subtitle }: TestfeatureProps) {
  return (
    <section className="p-6">
      <h2 className="text-xl font-semibold">Testfeature</h2>
      {title ? <p className="mt-2 text-gray-600">{title}</p> : null}
      {subtitle ? <p className="text-gray-500">{subtitle}</p> : null}
    </section>
  );
}
