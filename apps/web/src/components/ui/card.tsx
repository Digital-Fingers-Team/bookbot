import type { HTMLAttributes } from "react";
import { clsx } from "clsx";

// Card surface: one radius (rounded-xl / 12px) and one border/background pair
// for every card in the app, so card corners stop drifting between rounded-2xl
// and rounded-lg from screen to screen.
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-line bg-white p-5 dark:border-white/10 dark:bg-[#0c0c0e]",
        className
      )}
      {...props}
    />
  );
}
