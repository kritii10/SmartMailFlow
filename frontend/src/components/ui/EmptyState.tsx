import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export const EmptyState = ({ action, description, title }: EmptyStateProps) => (
  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
    <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
    <p className="mt-2 text-sm text-slate-500">{description}</p>
    {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
  </div>
);
