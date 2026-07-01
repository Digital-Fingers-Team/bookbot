import { forwardRef, type ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

// Single source of truth for button styling. Prevents the class-string drift
// that had the same "primary button" rendered at h-11/font-semibold in one
// place and h-10/font-medium in another. Convention: all buttons are h-10,
// font-medium, rounded-lg (the 8px control radius).
type Variant = "primary" | "secondary";

const base =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary: "bg-moss text-white hover:bg-moss/90",
  secondary:
    "border border-line bg-white text-ink hover:border-moss/40 hover:text-moss dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:text-sea"
};

export function buttonClass(variant: Variant = "primary", className?: string) {
  return clsx(base, variants[variant], className);
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", className, type = "button", ...props },
  ref
) {
  return <button ref={ref} type={type} className={buttonClass(variant, className)} {...props} />;
});
