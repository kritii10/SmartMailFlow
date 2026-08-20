import type { PropsWithChildren } from "react";
import { cn } from "../../utils/cn";

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-black/[0.06] text-ink",
  success: "bg-emerald-100 text-emerald-900",
  warning: "bg-amber-100 text-amber-900",
  danger: "bg-rose-100 text-rose-900",
  info: "bg-sky-100 text-sky-900"
};

type BadgeProps = PropsWithChildren<{
  tone?: BadgeTone;
  className?: string;
}>;

export const Badge = ({ children, className, tone = "neutral" }: BadgeProps) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]",
      toneClasses[tone],
      className
    )}
  >
    {children}
  </span>
);
