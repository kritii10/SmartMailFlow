import type { ReactNode } from "react";

type ErrorStateProps = {
  message: string;
  action?: ReactNode;
};

export const ErrorState = ({ action, message }: ErrorStateProps) => (
  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-5 text-sm text-rose-900">
    <p>{message}</p>
    {action ? <div className="mt-4">{action}</div> : null}
  </div>
);
