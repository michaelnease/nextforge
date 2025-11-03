import React from "react";

export interface BadgeProps {
  title?: string;
  subtitle?: string;
}

export default function Badge({ title, subtitle }: BadgeProps) {
  return (
    <section className="p-6">
      <h2 className="text-xl font-semibold">Badge</h2>
      {title ? <p className="mt-2 text-gray-600">{title}</p> : null}
      {subtitle ? <p className="text-gray-500">{subtitle}</p> : null}
    </section>
  );
}
