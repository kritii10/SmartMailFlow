import type { TextareaHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
  helperText?: string;
};

export const Textarea = ({
  className,
  error,
  helperText,
  label,
  ...props
}: TextareaProps) => (
  <label className="grid gap-2 text-sm text-ink/78">
    {label ? <span className="font-medium">{label}</span> : null}
    <textarea
      className={cn(
        "field-base min-h-32 resize-y",
        error && "border-rose-300 focus:border-rose-400 focus:ring-rose-100",
        className
      )}
      {...props}
    />
    {error ? <span className="text-xs text-rose-700">{error}</span> : null}
    {!error && helperText ? <span className="text-xs text-ink/55">{helperText}</span> : null}
  </label>
);
