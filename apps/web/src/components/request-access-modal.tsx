"use client";

import { FormEvent, useState } from "react";
import { Check, Loader2, Upload, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { submitAccessRequest, type CatalogBook, type DiscoveryBook } from "@/lib/api";
import { BookPicker } from "@/components/book-picker";
import { useT } from "@/lib/i18n";

type Target = { type: "book" | "category"; value: string; label: string };

export function RequestAccessModal({
  books,
  categories,
  defaultTarget,
  onClose,
  onSubmitted
}: {
  books: DiscoveryBook[];
  categories: string[];
  defaultTarget?: Target;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const { token } = useAuth();
  const t = useT();
  const [type, setType] = useState<"book" | "category">(defaultTarget?.type ?? (books.length ? "book" : "category"));
  const [value, setValue] = useState(defaultTarget?.value ?? "");
  const [bookLabel, setBookLabel] = useState(defaultTarget?.type === "book" ? defaultTarget.label : "");
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!value || !receipt || busy) {
      setError(!receipt ? t("req.needReceipt") : t("req.needTarget"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await submitAccessRequest({ targetType: type, targetValue: value, note, receipt }, token);
      // Briefly confirm success before closing so the user knows it's under review.
      setDone(true);
      setTimeout(() => onSubmitted(), 1400);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("req.failed"));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <form
        onSubmit={onSubmit}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md space-y-4 rounded-2xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-[#0c0c0e]"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink dark:text-white">{t("req.title")}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-ink/70 hover:text-ink dark:text-white/70">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex rounded-lg border border-line p-1 text-xs dark:border-white/10">
          {(["book", "category"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setType(option);
                setValue("");
                setBookLabel("");
              }}
              className={`flex-1 rounded-md py-1.5 font-medium transition ${
                type === option ? "bg-moss text-white" : "text-ink/70 dark:text-white/70"
              }`}
            >
              {option === "book" ? t("req.aBook") : t("req.aCategory")}
            </button>
          ))}
        </div>

        {type === "book" ? (
          value ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-moss/30 bg-moss/[0.06] px-3 py-2.5 dark:border-sea/30 dark:bg-sea/10">
              <span dir="auto" className="flex min-w-0 items-center gap-2 text-sm text-ink dark:text-white">
                <Check className="h-4 w-4 shrink-0 text-moss dark:text-sea" />
                <span className="truncate">{bookLabel}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setValue("");
                  setBookLabel("");
                }}
                aria-label="clear"
                className="shrink-0 text-ink/70 hover:text-ink dark:text-white/70"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <BookPicker
              onPick={(book: CatalogBook) => {
                setValue(book.id);
                setBookLabel(book.title);
              }}
              placeholder={t("req.pickBook")}
            />
          )
        ) : (
          <select
            value={value}
            onChange={(event) => setValue(event.target.value)}
            dir="auto"
            className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-moss dark:border-white/10 dark:bg-white/5 dark:text-white"
          >
            <option value="">{t("req.pickCategory")}</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        )}

        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-line px-3 py-2.5 text-sm text-ink/70 transition hover:border-moss/40 dark:border-white/15 dark:text-white/70">
          <Upload className="h-4 w-4" />
          <span className="truncate">{receipt ? receipt.name : t("req.uploadReceipt")}</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            className="hidden"
            onChange={(event) => setReceipt(event.target.files?.[0] ?? null)}
          />
        </label>

        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          dir="auto"
          placeholder={t("req.notePlaceholder")}
          className="w-full resize-none rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-moss dark:border-white/10 dark:bg-white/5 dark:text-white"
        />

        {error ? <p className="text-xs text-red-500">{error}</p> : null}

        <button
          type="submit"
          disabled={busy || done}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-moss text-sm font-semibold text-white transition hover:bg-moss/90 disabled:opacity-60"
        >
          {done ? <Check className="h-4 w-4" /> : busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {done ? t("req.submitted") : t("req.submit")}
        </button>
      </form>
    </div>
  );
}
