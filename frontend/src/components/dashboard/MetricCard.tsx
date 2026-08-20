import type { ReactNode } from "react";

type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
  accent?: ReactNode;
};

export const MetricCard = ({ accent, detail, label, value }: MetricCardProps) => (
  <article className="surface-panel p-5">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-ink/48">{label}</p>
        <p className="mt-3 font-serif text-4xl text-ink">{value}</p>
      </div>
      {accent}
    </div>
    <p className="mt-3 text-sm text-ink/62">{detail}</p>
  </article>
);
