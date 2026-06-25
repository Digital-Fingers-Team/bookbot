"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  BookOpenText,
  LayoutGrid,
  List as ListIcon,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { ApiClientError, deleteBook, getBookPdf, getStats, listBooks } from "@/lib/api";
import type { Book, Stats } from "@/lib/types";

type ViewMode = "grid" | "list";
type StatusFilter = "all" | "ready" | "processing" | "failed";
type SortKey = "recent" | "title" | "pages" | "chunks";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "ready", label: "Ready" },
  { key: "processing", label: "Processing" },
  { key: "failed", label: "Failed" }
];

const nf = new Intl.NumberFormat("en");

export default function LibraryPage() {
  const router = useRouter();
  const { token, user, isAdmin, loading: authLoading } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [readerBook, setReaderBook] = useState<Book | null>(null);
  const [readerUrl, setReaderUrl] = useState("");
  const [readerLoading, setReaderLoading] = useState(false);
  const [readerError, setReaderError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [view, setView] = useState<ViewMode>("grid");

  const closeReader = useCallback(() => {
    if (readerUrl) {
      URL.revokeObjectURL(readerUrl);
    }
    setReaderBook(null);
    setReaderUrl("");
    setReaderError("");
    setReaderLoading(false);
  }, [readerUrl]);

  const refresh = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [bookResult, statsResult] = await Promise.all([listBooks(token), isAdmin ? getStats(token) : Promise.resolve(null)]);
      setBooks(bookResult.books);
      setStats(statsResult);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not load the library.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, token]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      router.replace("/login?next=/library");
      return;
    }

    refresh();
  }, [authLoading, refresh, router, user]);

  useEffect(() => {
    return () => {
      if (readerUrl) {
        URL.revokeObjectURL(readerUrl);
      }
    };
  }, [readerUrl]);

  // Poll while any book is still being processed so progress updates live.
  const hasProcessing = books.some((book) => book.status === "processing");
  useEffect(() => {
    if (!token || !hasProcessing) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const result = await listBooks(token);
        setBooks(result.books);
      } catch {
        // Ignore transient polling errors; the manual refresh still works.
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [token, hasProcessing]);

  async function removeBook(book: Book) {
    if (!window.confirm(`Delete "${book.title}" and all of its chunks?`)) {
      return;
    }

    setDeletingId(book.id);
    setError("");

    try {
      await deleteBook(book.id, token);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not delete this book.");
    } finally {
      setDeletingId("");
    }
  }

  async function openBook(book: Book) {
    if (readerUrl) {
      URL.revokeObjectURL(readerUrl);
    }

    setReaderBook(book);
    setReaderUrl("");
    setReaderError("");
    setReaderLoading(true);

    try {
      const blob = await getBookPdf(book.id, token);
      setReaderUrl(URL.createObjectURL(blob));
    } catch (err) {
      setReaderError(err instanceof ApiClientError ? err.message : "Could not open this book.");
    } finally {
      setReaderLoading(false);
    }
  }

  const statusCounts = useMemo(
    () => ({
      all: books.length,
      ready: books.filter((book) => book.status === "ready").length,
      processing: books.filter((book) => book.status === "processing").length,
      failed: books.filter((book) => book.status === "failed").length
    }),
    [books]
  );

  const visibleBooks = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = books.filter((book) => {
      if (statusFilter !== "all" && book.status !== statusFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        book.title.toLowerCase().includes(query) ||
        book.originalFileName.toLowerCase().includes(query) ||
        (book.author ?? "").toLowerCase().includes(query)
      );
    });

    return [...filtered].sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "pages") return b.pageCount - a.pageCount;
      if (sort === "chunks") return b.chunkCount - a.chunkCount;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [books, search, statusFilter, sort]);

  const totals = {
    books: stats?.totalBooks ?? books.length,
    pages: stats?.totalPages ?? books.reduce((total, book) => total + book.pageCount, 0),
    chunks: stats?.totalChunks ?? books.reduce((total, book) => total + book.chunkCount, 0)
  };

  if (authLoading || !user) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-6 dark:border-white/10 dark:bg-[#0c0c0e]">
        <div className="flex items-center gap-3 text-sm font-medium text-ink/60 dark:text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" />
          {authLoading ? "Checking your session…" : "Redirecting to sign in…"}
        </div>
      </div>
    );
  }

  const isFiltering = Boolean(search.trim()) || statusFilter !== "all";

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink dark:text-white">Library</h1>
          <p className="mt-1.5 text-sm text-ink/55 dark:text-white/55">
            {loading ? (
              "Loading your books…"
            ) : (
              <>
                <span className="font-medium text-ink/70 dark:text-white/70">{nf.format(totals.books)}</span> books ·{" "}
                <span className="font-medium text-ink/70 dark:text-white/70">{nf.format(totals.pages)}</span> pages ·{" "}
                <span className="font-medium text-ink/70 dark:text-white/70">{nf.format(totals.chunks)}</span> searchable chunks
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line bg-white px-3.5 text-sm font-medium text-ink/70 transition hover:border-moss/40 hover:text-moss dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:text-sea"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          {isAdmin ? (
            <Link
              href="/upload"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-moss px-4 text-sm font-medium text-white transition hover:bg-moss/90"
            >
              <Plus className="h-4 w-4" />
              Upload
            </Link>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      {/* Toolbar: search · status tabs · sort · view */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35 dark:text-white/35" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title, file name, or author…"
              className="h-10 w-full rounded-lg border border-line bg-white pl-9 pr-9 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-moss focus:ring-2 focus:ring-moss/15 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/35"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-ink/40 transition hover:bg-ink/5 hover:text-ink dark:text-white/40 dark:hover:bg-white/10"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink/80 outline-none transition focus:border-moss dark:border-white/10 dark:bg-white/5 dark:text-white/80"
              aria-label="Sort books"
            >
              <option value="recent">Newest first</option>
              <option value="title">Title A–Z</option>
              <option value="pages">Most pages</option>
              <option value="chunks">Most chunks</option>
            </select>

            <div className="flex items-center rounded-lg border border-line bg-white p-1 dark:border-white/10 dark:bg-white/5">
              <ViewButton active={view === "grid"} onClick={() => setView("grid")} label="Grid view">
                <LayoutGrid className="h-4 w-4" />
              </ViewButton>
              <ViewButton active={view === "list"} onClick={() => setView("list")} label="List view">
                <ListIcon className="h-4 w-4" />
              </ViewButton>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {STATUS_TABS.map((tab) => {
            const count = statusCounts[tab.key];
            const active = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition ${
                  active
                    ? "border-moss/30 bg-moss/10 text-moss dark:border-sea/30 dark:bg-sea/15 dark:text-sea"
                    : "border-line bg-white text-ink/55 hover:text-ink dark:border-white/10 dark:bg-white/5 dark:text-white/55 dark:hover:text-white"
                }`}
              >
                {tab.label}
                <span className={`tabular-nums ${active ? "opacity-80" : "opacity-50"}`}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        view === "grid" ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="overflow-hidden rounded-2xl border border-line bg-white dark:border-white/10 dark:bg-[#0c0c0e]">
                <div className="border-b border-line bg-paper p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="skeleton mx-auto aspect-[3/4] max-h-64 w-full max-w-44 rounded-md" />
                </div>
                <div className="space-y-3 p-4">
                  <div className="skeleton h-4 w-3/4 rounded" />
                  <div className="skeleton h-3 w-1/2 rounded" />
                  <div className="skeleton h-8 w-full rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white dark:divide-white/10 dark:border-white/10 dark:bg-[#0c0c0e]">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex items-center gap-4 px-4 py-3.5">
                <div className="skeleton h-12 w-9 shrink-0 rounded" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3.5 w-1/3 rounded" />
                  <div className="skeleton h-3 w-1/4 rounded" />
                </div>
              </div>
            ))}
          </div>
        )
      ) : visibleBooks.length ? (
        <>
          {isFiltering ? (
            <p className="-mt-2 text-xs text-ink/45 dark:text-white/45">
              Showing {visibleBooks.length} of {books.length} {books.length === 1 ? "book" : "books"}
            </p>
          ) : null}

          {view === "grid" ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {visibleBooks.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  isAdmin={isAdmin}
                  deleting={deletingId === book.id}
                  onOpen={() => openBook(book)}
                  onDelete={() => removeBook(book)}
                />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white dark:divide-white/10 dark:border-white/10 dark:bg-[#0c0c0e]">
              {visibleBooks.map((book) => (
                <BookRow
                  key={book.id}
                  book={book}
                  isAdmin={isAdmin}
                  deleting={deletingId === book.id}
                  onOpen={() => openBook(book)}
                  onDelete={() => removeBook(book)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <EmptyState filtering={isFiltering} isAdmin={isAdmin} onClear={() => { setSearch(""); setStatusFilter("all"); }} />
      )}

      {readerBook ? (
        <Reader
          book={readerBook}
          url={readerUrl}
          loading={readerLoading}
          error={readerError}
          onClose={closeReader}
        />
      ) : null}
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  label,
  children
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition ${
        active
          ? "bg-moss/10 text-moss dark:bg-sea/15 dark:text-sea"
          : "text-ink/40 hover:text-ink dark:text-white/40 dark:hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function BookCard({
  book,
  isAdmin,
  deleting,
  onOpen,
  onDelete
}: {
  book: Book;
  isAdmin: boolean;
  deleting: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-line bg-white text-left transition hover:border-moss/30 hover:shadow-soft focus:outline-none focus:ring-2 focus:ring-moss/25 dark:border-white/10 dark:bg-[#0c0c0e]"
    >
      <div className="relative border-b border-line bg-paper p-4 dark:border-white/10 dark:bg-white/[0.03]">
        {isAdmin ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            disabled={deleting}
            className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white/90 text-ink/50 opacity-0 backdrop-blur transition hover:border-red-300 hover:text-red-600 focus:opacity-100 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-[#0c0c0e]/80 dark:text-white/50 dark:hover:border-red-500/40 dark:hover:text-red-300"
            aria-label={`Delete ${book.title}`}
            title={`Delete ${book.title}`}
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        ) : null}
        <div className="mx-auto flex aspect-[3/4] max-h-64 w-full max-w-44 flex-col rounded-md border border-black/[0.06] bg-white p-5 shadow-[8px_12px_26px_rgba(24,24,27,0.12)] transition group-hover:-translate-y-0.5 dark:border-black/10 dark:bg-paper">
          <div className="h-1.5 w-12 rounded-full bg-moss/70" />
          <p dir="auto" className="mt-5 line-clamp-5 text-xs leading-5 text-ink/60">
            {book.firstPageText || "First page preview appears here after text is extracted."}
          </p>
          <div className="mt-auto space-y-2">
            <div className="h-1.5 w-full rounded bg-moss/15" />
            <div className="h-1.5 w-2/3 rounded bg-moss/15" />
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h2 dir="auto" className="line-clamp-2 text-[0.95rem] font-semibold leading-6 text-ink dark:text-white">
            {book.title}
          </h2>
          <p className="mt-1 truncate text-xs text-ink/45 dark:text-white/45">
            {book.author ? `${book.author} · ` : ""}
            {book.originalFileName}
          </p>
        </div>

        <StatusBadge book={book} />

        <div className="mt-auto flex items-center justify-between border-t border-line/70 pt-3 dark:border-white/10">
          <span className="text-xs text-ink/50 dark:text-white/50">
            {nf.format(book.pageCount)} pages · {nf.format(book.chunkCount)} chunks
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-moss transition group-hover:gap-1.5 dark:text-sea">
            Open
            <BookOpenText className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </article>
  );
}

function BookRow({
  book,
  isAdmin,
  deleting,
  onOpen,
  onDelete
}: {
  book: Book;
  isAdmin: boolean;
  deleting: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className="group flex cursor-pointer items-center gap-4 px-4 py-3.5 transition hover:bg-paper focus:outline-none focus:ring-2 focus:ring-inset focus:ring-moss/25 dark:hover:bg-white/[0.03]"
    >
      <span className="flex h-12 w-9 shrink-0 items-center justify-center rounded border border-line bg-paper text-moss dark:border-white/10 dark:bg-white/5 dark:text-sea">
        <BookOpenText className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p dir="auto" className="truncate text-sm font-semibold text-ink dark:text-white">{book.title}</p>
        <p className="truncate text-xs text-ink/45 dark:text-white/45">
          {book.author ? `${book.author} · ` : ""}
          {book.originalFileName}
        </p>
      </div>
      <div className="hidden shrink-0 sm:block">
        <StatusBadge book={book} compact />
      </div>
      <div className="hidden w-28 shrink-0 text-right text-xs text-ink/55 dark:text-white/55 md:block">
        {nf.format(book.pageCount)} pages
      </div>
      <div className="hidden w-28 shrink-0 text-right text-xs text-ink/55 dark:text-white/55 md:block">
        {nf.format(book.chunkCount)} chunks
      </div>
      {isAdmin ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          disabled={deleting}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink/40 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-white/40 dark:hover:bg-red-500/10 dark:hover:text-red-300"
          aria-label={`Delete ${book.title}`}
          title={`Delete ${book.title}`}
        >
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </button>
      ) : null}
    </div>
  );
}

function EmptyState({ filtering, isAdmin, onClear }: { filtering: boolean; isAdmin: boolean; onClear: () => void }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-paper p-12 text-center dark:border-white/10 dark:bg-white/[0.02]">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-moss/10 text-moss dark:bg-sea/15 dark:text-sea">
        <BookOpenText className="h-6 w-6" />
      </span>
      {filtering ? (
        <>
          <p className="mt-4 text-sm font-semibold text-ink dark:text-white">No books match your filters</p>
          <p className="mt-1 text-sm text-ink/50 dark:text-white/50">Try a different search or status.</p>
          <button
            type="button"
            onClick={onClear}
            className="mt-4 inline-flex h-9 items-center rounded-lg border border-line bg-white px-3.5 text-sm font-medium text-ink/70 transition hover:border-moss/40 hover:text-moss dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:text-sea"
          >
            Clear filters
          </button>
        </>
      ) : (
        <>
          <p className="mt-4 text-sm font-semibold text-ink dark:text-white">No books yet</p>
          <p className="mt-1 max-w-xs text-sm text-ink/50 dark:text-white/50">
            {isAdmin
              ? "Upload a PDF to start building your searchable knowledge base."
              : "Once an admin uploads books, they'll appear here for you to search."}
          </p>
          {isAdmin ? (
            <Link
              href="/upload"
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-moss px-4 text-sm font-medium text-white transition hover:bg-moss/90"
            >
              <Plus className="h-4 w-4" />
              Upload your first book
            </Link>
          ) : null}
        </>
      )}
    </div>
  );
}

function Reader({
  book,
  url,
  loading,
  error,
  onClose
}: {
  book: Book;
  url: string;
  loading: boolean;
  error: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 p-3 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <div
        className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-soft dark:border-white/10 dark:bg-[#0c0c0e]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 dark:border-white/10">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-ink dark:text-white">{book.title}</h2>
            <p className="truncate text-xs text-ink/45 dark:text-white/45">{book.originalFileName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-ink/70 transition hover:border-moss/40 hover:text-moss dark:border-white/10 dark:text-white/70 dark:hover:text-sea"
            aria-label="Close reader"
            title="Close reader (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 bg-paper dark:bg-[#08080a]">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-ink/60 dark:text-white/60">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Opening book…
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center p-6 text-center">
              <div className="max-w-md rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                <AlertCircle className="mx-auto mb-2 h-5 w-5" />
                {error}
              </div>
            </div>
          ) : url ? (
            <iframe src={url} title={book.title} className="h-full w-full bg-white" />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ book, compact = false }: { book: Book; compact?: boolean }) {
  if (book.status === "failed") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
        title={book.error || undefined}
      >
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        {compact ? "Failed" : "Failed — delete & re-upload"}
      </span>
    );
  }

  if (book.status === "processing") {
    const label = book.pageCount ? `Processing ${book.processedPages}/${book.pageCount}` : "Processing…";
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300">
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
        {compact ? "Processing" : label}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-moss/20 bg-moss/[0.06] px-2.5 py-1 text-xs font-medium text-moss dark:border-sea/25 dark:bg-sea/10 dark:text-sea">
      <span className="h-1.5 w-1.5 rounded-full bg-moss dark:bg-sea" />
      Ready
    </span>
  );
}
