"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Download, ExternalLink, Loader2, Lock } from "lucide-react";
import { ApiClientError, getBookPageText } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { useT } from "@/lib/i18n";

type TextReaderProps = {
  bookId: string;
  sourceUrl: string;
  // Whether an admin has granted this user download rights for this book.
  // When false, the Open/Download toolbar buttons are shown disabled instead
  // of hidden, so it's clear the capability exists but was turned off.
  canDownload: boolean;
  title: string;
  page: number;
  totalPages?: number;
  onPageChange: (page: number) => void;
};

export function TextReader({ bookId, sourceUrl, canDownload, title, page, totalPages, onPageChange }: TextReaderProps) {
  const { token } = useAuth();
  const t = useT();
  const pageCount = totalPages ?? 1;
  const [pageInput, setPageInput] = useState(String(page));
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Cache of fetched page text so flipping back/forward and prefetched
  // neighbours are instant. Cleared when the book changes.
  const pageCacheRef = useRef<Map<number, string>>(new Map());

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  useEffect(() => {
    pageCacheRef.current.clear();
  }, [bookId]);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function getPage(target: number): Promise<string> {
      const cached = pageCacheRef.current.get(target);
      if (cached !== undefined) {
        return cached;
      }
      const result = await getBookPageText(bookId, target, token, controller.signal);
      pageCacheRef.current.set(target, result.text);
      return result.text;
    }

    setLoading(true);
    setError("");

    getPage(page)
      .then((pageText) => {
        if (cancelled) {
          return;
        }
        setText(pageText);
        setLoading(false);
        // Prefetch neighbours so the next/previous flip is instant.
        if (page + 1 <= pageCount) {
          getPage(page + 1).catch(() => undefined);
        }
        if (page - 1 >= 1) {
          getPage(page - 1).catch(() => undefined);
        }
      })
      .catch((err) => {
        if (cancelled || (err as Error)?.name === "AbortError") {
          return;
        }
        setError(err instanceof ApiClientError ? err.message : t("read.notFound"));
        setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [bookId, page, pageCount, t, token]);

  const jumpTo = useCallback(
    (targetPage: number) => {
      if (!Number.isFinite(targetPage)) {
        return;
      }
      onPageChange(Math.min(Math.max(1, Math.floor(targetPage)), pageCount));
    },
    [onPageChange, pageCount]
  );

  // Keyboard navigation: ←/→ flip pages (ignored while typing in the page box).
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }
      if (event.key === "ArrowLeft") {
        jumpTo(page - 1);
      } else if (event.key === "ArrowRight") {
        jumpTo(page + 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [jumpTo, page]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-100 dark:bg-[#08080a]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-white px-3 py-2 dark:border-white/10 dark:bg-[#0c0c0e]">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => jumpTo(page - 1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink/70 transition enabled:hover:bg-ink/5 enabled:hover:text-moss disabled:opacity-30 dark:text-white/70 dark:enabled:hover:bg-white/10 dark:enabled:hover:text-sea"
            aria-label={t("read.goToPage")}
          >
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          </button>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              jumpTo(Number(pageInput));
            }}
            className="flex items-center gap-1.5 text-sm"
          >
            <input
              value={pageInput}
              onChange={(event) => setPageInput(event.target.value)}
              inputMode="numeric"
              aria-label={t("read.goToPage")}
              className="h-8 w-14 rounded-lg border border-line bg-paper text-center font-semibold text-ink outline-none focus:border-moss dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
            <span className="text-ink/70 dark:text-white/70">/ {pageCount}</span>
          </form>
          <button
            type="button"
            disabled={page >= pageCount}
            onClick={() => jumpTo(page + 1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink/70 transition enabled:hover:bg-ink/5 enabled:hover:text-moss disabled:opacity-30 dark:text-white/70 dark:enabled:hover:bg-white/10 dark:enabled:hover:text-sea"
            aria-label={t("read.goToPage")}
          >
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          {canDownload && sourceUrl ? (
            <>
              <a
                href={sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink/70 transition hover:bg-ink/5 hover:text-moss dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-sea"
                aria-label="Open"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
              <a
                href={sourceUrl}
                download={title}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink/70 transition hover:bg-ink/5 hover:text-moss dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-sea"
                aria-label="Download"
              >
                <Download className="h-4 w-4" />
              </a>
            </>
          ) : (
            <button
              type="button"
              disabled
              title={t("read.downloadDisabled")}
              aria-label={t("read.downloadDisabled")}
              className="inline-flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-lg text-ink/25 dark:text-white/25"
            >
              <Lock className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-auto p-4 sm:p-6">
        {error ? (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <div className="max-w-md rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              <AlertCircle className="mx-auto mb-2 h-5 w-5" />
              {error}
            </div>
          </div>
        ) : (
          <article
            dir="auto"
            className="mx-auto max-w-2xl whitespace-pre-wrap break-words rounded-xl bg-white p-6 text-[15px] leading-8 text-ink shadow-xl ring-1 ring-black/10 dark:bg-[#0c0c0e] dark:text-white dark:ring-white/10"
          >
            {text}
          </article>
        )}

        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/35 backdrop-blur-[1px] dark:bg-black/20">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink/70 shadow-sm dark:border-white/10 dark:bg-[#0c0c0e] dark:text-white/70">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t("read.opening")}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
