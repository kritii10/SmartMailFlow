import { cn } from "../../utils/cn";

type SpinnerProps = {
  className?: string;
  label?: string;
};

export const Spinner = ({ className, label }: SpinnerProps) => (
  <div className="flex items-center gap-3 text-sm text-ink/65">
    <span
      aria-hidden="true"
      className={cn(
        "inline-block h-5 w-5 animate-spin rounded-full border-2 border-coral/20 border-t-coral",
        className
      )}
    />
    {label ? <span>{label}</span> : null}
  </div>
);
