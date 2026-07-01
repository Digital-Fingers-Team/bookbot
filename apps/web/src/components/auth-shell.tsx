import { AlertCircle } from "lucide-react";

// Shared styling for auth inputs so Login and Register stay identical.
export const authInputClass =
  "h-11 w-full rounded-lg border border-line bg-white px-3.5 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-moss focus:ring-2 focus:ring-moss/15 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/35";

export function AuthShell({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center py-6">
      <div className="mb-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.jpeg" alt="" className="mx-auto h-12 w-12 rounded-2xl" />
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink dark:text-white">{title}</h1>
        <p className="mx-auto mt-1.5 max-w-xs text-sm leading-6 text-ink/70 dark:text-white/70">{subtitle}</p>
      </div>
      <div className="rounded-2xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-[#0c0c0e]">
        {children}
      </div>
    </div>
  );
}

export function AuthField({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink/80 dark:text-white/80">{label}</span>
      {children}
    </label>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}
