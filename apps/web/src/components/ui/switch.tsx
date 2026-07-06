import { clsx } from "clsx";

// A small on/off pill toggle. Uses flex justify-start/end (not a translate-x
// transform) so the knob position is direction-aware for free under RTL.
export function Switch({
  checked,
  onChange,
  disabled,
  label
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={clsx(
        "inline-flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "justify-end bg-moss dark:bg-sea" : "justify-start bg-ink/15 dark:bg-white/15"
      )}
    >
      <span className="h-3.5 w-3.5 rounded-full bg-white shadow-sm transition" />
    </button>
  );
}
