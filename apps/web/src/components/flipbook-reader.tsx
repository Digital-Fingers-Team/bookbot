"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import HTMLFlipBook from "react-pageflip";
import { AlertCircle, ChevronLeft, ChevronRight, Download, ExternalLink, Loader2, Lock } from "lucide-react";
import { ApiClientError, getBookPageImage, getBookPageText } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { useT } from "@/lib/i18n";

type FlipbookReaderProps = {
  bookId: string;
  sourceUrl: string;
  canDownload: boolean;
  title: string;
  page: number;
  totalPages?: number;
  kind: "pdf" | "text";
  onPageChange: (page: number) => void;
};

type PageProps = { bookId: string; page: number; activePage: number; kind: "pdf" | "text"; title: string };

const FlipPage = forwardRef<HTMLDivElement, PageProps>(function FlipPage({ bookId, page, activePage, kind, title }, ref) {
  const { token } = useAuth();
  const t = useT();
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const objectUrlRef = useRef("");
  const loadedRef = useRef(false);
  const requestRef = useRef(false);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, [bookId]);

  // Only load pages around the visible spread. This keeps large books private
  // and avoids downloading an entire book just to initialise the flip engine.
  useEffect(() => {
    if (Math.abs(page - activePage) > 2 || loadedRef.current || requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = true;
    setLoading(true);
    setError("");

    const load = kind === "pdf"
      ? getBookPageImage(bookId, page, token, controller.signal).then((blob) => {
          const objectUrl = URL.createObjectURL(blob);
          objectUrlRef.current = objectUrl;
          loadedRef.current = true;
          setImageUrl(objectUrl);
        })
      : getBookPageText(bookId, page, token, controller.signal).then((result) => {
          loadedRef.current = true;
          setText(result.text);
        });

    load.catch((err) => {
      if (!controller.signal.aborted) setError(err instanceof ApiClientError ? err.message : t("read.notFound"));
    }).finally(() => {
      requestRef.current = false;
      if (!controller.signal.aborted) setLoading(false);
    });

    return () => {
      controller.abort();
    };
  }, [activePage, bookId, kind, page, t, token]);

  return (
    <div ref={ref} className="flipbook-page" dir="auto">
      <div className="flipbook-page-inner">
        {error ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-xs text-red-600 dark:text-red-300">
            <AlertCircle className="me-2 h-4 w-4 shrink-0" />{error}
          </div>
        ) : kind === "pdf" && imageUrl ? (
          <img src={imageUrl} alt={`${title} - ${t("ask.page")} ${page}`} className="h-full w-full object-contain" />
        ) : kind === "text" && text ? (
          <article className="h-full overflow-hidden whitespace-pre-wrap break-words p-8 text-[15px] leading-8 text-ink dark:text-white">{text}</article>
        ) : loading ? (
          <div className="flex h-full items-center justify-center text-ink/60 dark:text-white/60"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : null}
        <span className="flipbook-page-number">{page}</span>
      </div>
    </div>
  );
});

export function FlipbookReader({ bookId, sourceUrl, canDownload, title, page, totalPages, kind, onPageChange }: FlipbookReaderProps) {
  const { token } = useAuth();
  const t = useT();
  const pageCount = Math.max(1, totalPages ?? 1);
  const [pageInput, setPageInput] = useState(String(page));
  const [activePage, setActivePage] = useState(page - 1);
  const [error, setError] = useState("");
  const bookRef = useRef<any>(null);

  useEffect(() => setPageInput(String(page)), [page]);
  useEffect(() => {
    setActivePage(page - 1);
    const flipBook = bookRef.current?.pageFlip?.();
    if (flipBook && flipBook.getCurrentPageIndex() !== page - 1) flipBook.turnToPage(page - 1);
  }, [page]);

  function jumpTo(target: number) {
    const next = Math.min(Math.max(1, Math.floor(target)), pageCount);
    if (Number.isFinite(next)) onPageChange(next);
  }

  function handleFlip(event: { data: number }) {
    const next = Math.min(pageCount, Math.max(1, event.data + 1));
    setActivePage(event.data);
    if (next !== page) onPageChange(next);
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-100 dark:bg-[#08080a]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-white px-3 py-2 dark:border-white/10 dark:bg-[#0c0c0e]">
        <div className="flex items-center gap-2">
          <button type="button" disabled={page <= 1} onClick={() => bookRef.current?.pageFlip?.().flipPrev("bottom")} className="reader-control" aria-label={t("read.goToPage")}><ChevronLeft className="h-4 w-4 rtl:rotate-180" /></button>
          <form onSubmit={(event) => { event.preventDefault(); jumpTo(Number(pageInput)); }} className="flex items-center gap-1.5 text-sm">
            <input value={pageInput} onChange={(event) => setPageInput(event.target.value)} inputMode="numeric" aria-label={t("read.goToPage")} className="h-8 w-14 rounded-lg border border-line bg-paper text-center font-semibold text-ink outline-none focus:border-moss dark:border-white/10 dark:bg-white/5 dark:text-white" />
            <span className="text-ink/70 dark:text-white/70">/ {pageCount}</span>
          </form>
          <button type="button" disabled={page >= pageCount} onClick={() => bookRef.current?.pageFlip?.().flipNext("bottom")} className="reader-control" aria-label={t("read.goToPage")}><ChevronRight className="h-4 w-4 rtl:rotate-180" /></button>
        </div>
        <div className="flex items-center gap-1">
          {canDownload && sourceUrl ? <><a href={`${kind === "pdf" ? `${sourceUrl}#page=${page}` : sourceUrl}`} target="_blank" rel="noreferrer" className="reader-control" aria-label="Open"><ExternalLink className="h-4 w-4" /></a><a href={sourceUrl} download={title} className="reader-control" aria-label="Download"><Download className="h-4 w-4" /></a></> : <button type="button" disabled className="reader-control cursor-not-allowed opacity-30" aria-label={t("read.downloadDisabled")}><Lock className="h-4 w-4" /></button>}
        </div>
      </div>
      <div className="relative min-h-0 flex-1 overflow-auto p-4 sm:p-6">
        {error ? <div className="flex h-full items-center justify-center text-sm text-red-600">{error}</div> : (
          <div className="flipbook-shell">
            <HTMLFlipBook
              ref={bookRef}
              width={420}
              height={620}
              size="stretch"
              minWidth={280}
              maxWidth={620}
              minHeight={400}
              maxHeight={860}
              startPage={page - 1}
              drawShadow
              maxShadowOpacity={0.78}
              flippingTime={1100}
              usePortrait
              startZIndex={0}
              showCover
              showPageCorners
              // Heyzine-style interaction: a page is caught from its corner;
              // pressing the page body must not instantly turn it.
              disableFlipByClick
              mobileScrollSupport={false}
              clickEventForward
              useMouseEvents
              swipeDistance={30}
              autoSize={false}
              className="flipbook"
              style={{ margin: "0 auto" }}
              onFlip={handleFlip}
              onChangeState={(event) => { if (event.data === "read") setError(""); }}
            >
              {Array.from({ length: pageCount }, (_, index) => <FlipPage key={`${bookId}-${index + 1}`} bookId={bookId} page={index + 1} activePage={activePage + 1} kind={kind} title={title} />)}
            </HTMLFlipBook>
          </div>
        )}
      </div>
    </div>
  );
}
