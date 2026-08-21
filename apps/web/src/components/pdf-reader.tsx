"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  Lock,
  Maximize2,
  Minus,
  MoveHorizontal,
  Plus
} from "lucide-react";
import { ApiClientError, getBookPageImage } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { useT } from "@/lib/i18n";

type PdfReaderProps = {
  bookId: string;
  url: string;
  // Whether an admin has granted this user download rights for this book.
  // When false, the Open/Download toolbar buttons are shown disabled instead
  // of hidden, so it's clear the capability exists but was turned off.
  canDownload: boolean;
  title: string;
  page: number;
  totalPages?: number;
  onPageChange: (page: number) => void;
};

const zoomLevels = [70, 85, 100, 115, 130, 150] as const;
const initialZoom = 100;
const minZoom = 70;
const maxZoom = 150;

type FitMode = "width" | "page";

export function PdfReader({ bookId, url, canDownload, title, page, totalPages, onPageChange }: PdfReaderProps) {
  const { token } = useAuth();
  const t = useT();
  const pageCount = totalPages ?? 1;
  const [pageInput, setPageInput] = useState(String(page));
  const [imageUrl, setImageUrl] = useState("");
  const [zoom, setZoom] = useState(initialZoom);
  const [fitMode, setFitMode] = useState<FitMode>("width");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const previousPageRef = useRef(page);
  const [turnDirection, setTurnDirection] = useState<"next" | "prev">("next");
  const [dragProgress, setDragProgress] = useState(0);
  const dragRef = useRef<{ pointerId: number; startX: number; edge: "next" | "prev" } | null>(null);
  // Cache of rendered page images (object URLs) so flipping back/forward and
  // prefetched neighbours are instant. Revoked when the book changes/unmounts.
  const pageCacheRef = useRef<Map<number, string>>(new Map());

  useEffect(() => {
    setPageInput(String(page));
    if (page !== previousPageRef.current) {
      setTurnDirection(page > previousPageRef.current ? "next" : "prev");
      previousPageRef.current = page;
    }
  }, [page]);

  // Drop the page cache when switching books.
  useEffect(() => {
    const cache = pageCacheRef.current;
    return () => {
      cache.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
      cache.clear();
    };
  }, [bookId]);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function getPage(target: number): Promise<string> {
      const cached = pageCacheRef.current.get(target);
      if (cached) {
        return cached;
      }
      const blob = await getBookPageImage(bookId, target, token, controller.signal);
      const objectUrl = URL.createObjectURL(blob);
      pageCacheRef.current.set(target, objectUrl);
      return objectUrl;
    }

    setLoading(true);
    setError("");

    getPage(page)
      .then((objectUrl) => {
        if (cancelled) {
          return;
        }
        setImageUrl(objectUrl);
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

  function startPageDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const edge = event.clientX < bounds.left + 96 ? "prev" : event.clientX > bounds.right - 96 ? "next" : null;
    if (!edge || (edge === "prev" && page <= 1) || (edge === "next" && page >= pageCount)) return;
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, edge };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function movePageDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const delta = event.clientX - drag.startX;
    const progress = drag.edge === "next" ? Math.max(0, Math.min(1, -delta / 260)) : Math.max(0, Math.min(1, delta / 260));
    setDragProgress(progress);
  }

  function endPageDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const turned = dragProgress > 0.2;
    dragRef.current = null;
    setDragProgress(0);
    if (turned) jumpTo(drag.edge === "next" ? page + 1 : page - 1);
  }

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

  function changeZoom(direction: -1 | 1) {
    setFitMode("width");
    const currentIndex = zoomLevels.findIndex((level) => level >= zoom);
    const index = currentIndex === -1 ? zoomLevels.length - 1 : currentIndex;
    const nextIndex = Math.min(Math.max(0, index + direction), zoomLevels.length - 1);
    setZoom(zoomLevels[nextIndex] ?? zoom);
  }

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
          <button
            type="button"
            disabled={zoom <= minZoom}
            onClick={() => changeZoom(-1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink/70 transition enabled:hover:bg-ink/5 enabled:hover:text-moss disabled:opacity-30 dark:text-white/70 dark:enabled:hover:bg-white/10 dark:enabled:hover:text-sea"
            aria-label="Zoom out"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="min-w-12 text-center text-xs font-semibold text-ink/70 dark:text-white/70">{zoom}%</span>
          <button
            type="button"
            disabled={zoom >= maxZoom}
            onClick={() => changeZoom(1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink/70 transition enabled:hover:bg-ink/5 enabled:hover:text-moss disabled:opacity-30 dark:text-white/70 dark:enabled:hover:bg-white/10 dark:enabled:hover:text-sea"
            aria-label="Zoom in"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setFitMode((mode) => (mode === "page" ? "width" : "page"))}
            aria-pressed={fitMode === "page"}
            title={fitMode === "page" ? t("read.fitWidth") : t("read.fitPage")}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-ink/5 dark:hover:bg-white/10 ${
              fitMode === "page" ? "text-moss dark:text-sea" : "text-ink/70 dark:text-white/70"
            }`}
          >
            {fitMode === "page" ? <MoveHorizontal className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          {canDownload && url ? (
            <>
              <a
                href={`${url}#page=${page}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink/70 transition hover:bg-ink/5 hover:text-moss dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-sea"
                aria-label="Open"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
              <a
                href={url}
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

      <div
        className="relative min-h-0 flex-1 overflow-auto p-4 sm:p-6"
        style={{ touchAction: "pan-y" }}
        onPointerDown={startPageDrag}
        onPointerMove={movePageDrag}
        onPointerUp={endPageDrag}
        onPointerCancel={endPageDrag}
      >
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => jumpTo(page - 1)}
          className="absolute start-2 top-1/2 z-10 hidden h-12 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-ink/60 shadow-md ring-1 ring-black/10 transition hover:text-moss disabled:opacity-0 sm:flex dark:bg-[#0c0c0e]/80 dark:text-white/60 dark:ring-white/10 dark:hover:text-sea"
          aria-label={t("read.goToPage")}
        >
          <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
        </button>
        <button
          type="button"
          disabled={page >= pageCount}
          onClick={() => jumpTo(page + 1)}
          className="absolute end-2 top-1/2 z-10 hidden h-12 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-ink/60 shadow-md ring-1 ring-black/10 transition hover:text-moss disabled:opacity-0 sm:flex dark:bg-[#0c0c0e]/80 dark:text-white/60 dark:ring-white/10 dark:hover:text-sea"
          aria-label={t("read.goToPage")}
        >
          <ChevronRight className="h-5 w-5 rtl:rotate-180" />
        </button>
        {error ? (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <div className="max-w-md rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              <AlertCircle className="mx-auto mb-2 h-5 w-5" />
              {error}
            </div>
          </div>
        ) : imageUrl ? (
          fitMode === "page" ? (
            // Fit the whole page within the visible area (both dimensions).
            <div className="flex h-full w-full items-start justify-center">
              <img
                key={page}
                src={imageUrl}
                alt={`${title} - ${t("ask.page")} ${page}`}
                className={`book-page-turn-${turnDirection} max-h-full w-auto max-w-full object-contain bg-white shadow-xl ring-1 ring-black/10 dark:ring-white/10`}
                style={dragProgress ? { transform: `perspective(1600px) rotateY(${turnDirection === "next" ? -dragProgress * 70 : dragProgress * 70}deg)` } : undefined}
              />
            </div>
          ) : (
            // Fit the column width; zoom past 100% scrolls horizontally.
            <div className="min-h-full w-full">
              <img
                key={page}
                src={imageUrl}
                alt={`${title} - ${t("ask.page")} ${page}`}
                className={`book-page-turn-${turnDirection} mx-auto block max-w-none bg-white shadow-xl ring-1 ring-black/10 dark:ring-white/10`}
                style={{ width: `${zoom}%`, transformOrigin: "center top", ...(dragProgress ? { transform: `perspective(1600px) rotateY(${turnDirection === "next" ? -dragProgress * 70 : dragProgress * 70}deg)` } : {}) }}
              />
            </div>
          )
        ) : null}

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
