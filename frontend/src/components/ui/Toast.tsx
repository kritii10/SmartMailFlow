import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

type ToastProps = {
  open: boolean;
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: "success" | "error";
};

const toneClasses = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  error: "border-rose-200 bg-rose-50 text-rose-950"
};

export const Toast = ({
  action,
  description,
  open,
  title,
  tone = "success"
}: ToastProps) => {
  if (!open) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[60] w-full max-w-sm">
      <div
        className={cn(
          "pointer-events-auto rounded-2xl border px-4 py-4 shadow-lg",
          toneClasses[tone]
        )}
      >
        <p className="text-sm font-semibold">{title}</p>
        {description ? <p className="mt-1 text-sm opacity-80">{description}</p> : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </div>
  );
};
