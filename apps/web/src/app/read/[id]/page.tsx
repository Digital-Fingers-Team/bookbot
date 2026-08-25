"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, BookOpenText, Heart, Loader2, MessageSquareText, Music2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { ApiClientError, getBook, getBookPdf, getBookSource, getBookSummaryAudio, setFavorite, setProgress, type MyBook } from "@/lib/api";
import { BookAssistant } from "@/components/book-assistant";
import { FlipbookReader } from "@/components/flipbook-reader";
import { AI_NAME, useT } from "@/lib/i18n";

export default function ReadPage() {
  const params = useParams();
  const id = String(params.id);
  const router = useRouter();
  const { token, user, loading: authLoading } = useAuth();
  const t = useT();

  const [book, setBook] = useState<MyBook | null>(null);
  // The full PDF is only fetched when the admin has granted this user download
  // rights (see canDownload below) — page-by-page viewing never needs it, so a
  // user without download rights still reads normally, just without a raw file.
  const [url, setUrl] = useState("");
  const [summaryAudioUrl, setSummaryAudioUrl] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [favorite, setFav] = useState(false);
  const [tab, setTab] = useState<"book" | "assistant">("book");

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!user) {
      router.replace(`/login?next=/read/${id}`);
      return;
    }

    let cancelled = false;
    let createdUrl = "";
    let createdAudioUrl = "";

    (async () => {
      setLoading(true);
      setError("");
      try {
        const detail = await getBook(id, token);
        if (cancelled) return;
        setBook(detail);
        setSummaryAudioUrl("");
        setFav(detail.favorite);
        setPage(detail.lastPage || 1);
        void setProgress(id, detail.lastPage || 1, token).catch(() => undefined);

        if (detail.canDownload) {
          const blob = detail.sourceFormat === "pdf" ? await getBookPdf(id, token) : await getBookSource(id, token);
          createdUrl = URL.createObjectURL(blob);
          if (cancelled) {
            URL.revokeObjectURL(createdUrl);
            return;
          }
          setUrl(createdUrl);
        }
        if (detail.summaryAudio) {
          void getBookSummaryAudio(id, token).then((blob) => {
            if (cancelled) return;
            createdAudioUrl = URL.createObjectURL(blob);
            setSummaryAudioUrl(createdAudioUrl);
          }).catch(() => undefined);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiClientError ? err.message : t("read.notFound"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
      if (createdAudioUrl) {
        URL.revokeObjectURL(createdAudioUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, id, token]);

  function jumpTo(targetPage: number) {
    const max = book?.pageCount || targetPage;
    const next = Math.min(Math.max(1, Math.floor(targetPage)), max);
    if (!Number.isFinite(next)) {
      return;
    }
    setPage(next);
    setTab("book");
    void setProgress(id, next, token).catch(() => undefined);
  }

  async function toggleFavorite() {
    const next = !favorite;
    setFav(next);
    try {
      await setFavorite(id, next, token);
    } catch {
      setFav(!next);
    }
  }

  if (authLoading || (!user && !error)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-ink/70 dark:text-white/70">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-7rem)] min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-line bg-white dark:border-white/10 dark:bg-[#0c0c0e]">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 dark:border-white/10">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/my-books")}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-ink/70 transition hover:border-moss/40 hover:text-moss dark:border-white/10 dark:text-white/70 dark:hover:text-sea"
            aria-label={t("read.back")}
            title={t("read.back")}
          >
            <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </button>
          <div className="min-w-0">
            <h1 dir="auto" className="truncate text-sm font-semibold text-ink dark:text-white">
              {book?.title ?? "…"}
            </h1>
            {book?.author ? <p className="truncate text-xs text-ink/70 dark:text-white/70">{book.author}</p> : null}
          </div>
        </div>
        <button
          type="button"
          onClick={toggleFavorite}
          className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition ${
            favorite
              ? "border-moss/30 bg-moss/10 text-moss dark:border-sea/30 dark:bg-sea/15 dark:text-sea"
              : "border-line bg-white text-ink/70 hover:border-moss/40 hover:text-moss dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:text-sea"
          }`}
          title={favorite ? t("read.unfavorite") : t("read.favorite")}
        >
          <Heart className={`h-4 w-4 ${favorite ? "fill-current" : ""}`} />
        </button>
      </header>

      {summaryAudioUrl ? (
        <div className="flex items-center gap-3 border-b border-line bg-moss/[0.04] px-4 py-2.5 dark:border-white/10 dark:bg-sea/[0.05]">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-moss/10 text-moss dark:bg-sea/15 dark:text-sea"><Music2 className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-ink dark:text-white">Book summary</p><p className="text-[11px] text-ink/65 dark:text-white/65">Listen while you read</p></div>
          <audio controls preload="metadata" src={summaryAudioUrl} className="h-9 w-full max-w-md" />
        </div>
      ) : null}

      {/* Mobile tab switcher */}
      <div className="flex items-center gap-1 border-b border-line p-1.5 lg:hidden dark:border-white/10">
        <TabButton active={tab === "book"} onClick={() => setTab("book")} icon={BookOpenText} label={t("read.book")} />
        <TabButton active={tab === "assistant"} onClick={() => setTab("assistant")} icon={MessageSquareText} label={AI_NAME} />
      </div>

      <div className="min-h-0 flex-1 lg:grid lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className={`flex min-h-0 flex-col bg-paper dark:bg-[#08080a] ${tab === "book" ? "flex" : "hidden"} h-full lg:flex`}>
          <div className="min-h-0 flex-1">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-ink/70 dark:text-white/70">
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
                {t("read.opening")}
              </div>
            ) : error ? (
              <div className="flex h-full items-center justify-center p-6 text-center">
                <div className="max-w-md rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                  <AlertCircle className="mx-auto mb-2 h-5 w-5" />
                  {error}
                </div>
              </div>
            ) : book ? (
              <FlipbookReader
                bookId={id}
                sourceUrl={url}
                canDownload={Boolean(book.canDownload)}
                title={book.title}
                page={page}
                totalPages={book.pageCount}
                kind={book.sourceFormat === "pdf" ? "pdf" : "text"}
                onPageChange={jumpTo}
              />
            ) : null}
          </div>
        </div>

        <div className={`min-h-0 border-s border-line dark:border-white/10 ${tab === "assistant" ? "block" : "hidden"} h-full lg:block`}>
          <BookAssistant bookId={id} onJumpToPage={jumpTo} />
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof BookOpenText;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-medium transition ${
        active
          ? "bg-moss/10 text-moss dark:bg-sea/15 dark:text-sea"
          : "text-ink/70 hover:text-ink dark:text-white/70 dark:hover:text-white"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
