import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { cn } from "../../utils/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    fullWidth?: boolean;
  }
>;

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-coral text-white hover:opacity-90",
  secondary: "bg-ink text-sand hover:bg-ink/92",
  ghost: "border border-black/10 bg-white text-ink hover:bg-black/[0.03]",
  danger: "bg-rose-600 text-white hover:bg-rose-500"
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-2 text-sm",
  md: "px-4 py-2.5 text-sm",
  lg: "px-5 py-3 text-sm"
};

export const Button = ({
  children,
  className,
  fullWidth = false,
  size = "md",
  variant = "primary",
  ...props
}: ButtonProps) => (
  <button
    className={cn(
      "inline-flex items-center justify-center rounded-full font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/30 disabled:cursor-not-allowed disabled:opacity-60",
      variantClasses[variant],
      sizeClasses[size],
      fullWidth && "w-full",
      className
    )}
    {...props}
  >
    {children}
  </button>
);
