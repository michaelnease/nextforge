import React from "react";

export interface HybridProps {
  title?: string;
  subtitle?: string;
}

export default function Hybrid({ title, subtitle }: HybridProps) {
  return (
    <section className="p-6">
      <h2 className="text-xl font-semibold">Hybrid</h2>
      {title ? <p className="mt-2 text-gray-600">{title}</p> : null}
      {subtitle ? <p className="text-gray-500">{subtitle}</p> : null}
    </section>
  );
}
