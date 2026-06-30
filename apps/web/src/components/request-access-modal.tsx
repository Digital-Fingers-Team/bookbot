"use client";

import { FormEvent, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { submitAccessRequest, type DiscoveryBook } from "@/lib/api";
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
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
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
      onSubmitted();
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
          <button type="button" onClick={onClose} aria-label="Close" className="text-ink/40 hover:text-ink dark:text-white/40">
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
              }}
              className={`flex-1 rounded-md py-1.5 font-medium transition ${
                type === option ? "bg-moss text-white" : "text-ink/60 dark:text-white/60"
              }`}
            >
              {option === "book" ? t("req.aBook") : t("req.aCategory")}
            </button>
          ))}
        </div>

        <select
          value={value}
          onChange={(event) => setValue(event.target.value)}
          dir="auto"
          className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-moss dark:border-white/10 dark:bg-white/5 dark:text-white"
        >
          <option value="">{type === "book" ? t("req.pickBook") : t("req.pickCategory")}</option>
          {type === "book"
            ? books.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.title}
                </option>
              ))
            : categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
        </select>

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
          disabled={busy}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-moss text-sm font-semibold text-white transition hover:bg-moss/90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t("req.submit")}
        </button>
      </form>
    </div>
  );
}
