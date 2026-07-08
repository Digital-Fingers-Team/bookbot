"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n";

/** Generic replacement for window.confirm, styled to match the library page's delete modal. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  busy,
  error,
  onClose,
  onConfirm
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const t = useT();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm space-y-4 rounded-2xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-[#0c0c0e]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300">
            <Trash2 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-ink dark:text-white">{title}</h3>
            <p className="mt-1 text-sm text-ink/70 dark:text-white/70">{message}</p>
            {error ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex h-9 items-center rounded-lg border border-line bg-white px-3.5 text-sm font-medium text-ink/70 transition hover:text-ink disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:text-white"
          >
            {t("lib.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-3.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {confirmLabel ?? t("lib.delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
