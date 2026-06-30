"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  BookOpenText,
  Heart,
  LayoutGrid,
  List as ListIcon,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Tag,
  Trash2,
  User,
  X
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { BookCover } from "@/components/book-cover";
import { RequestAccessModal } from "@/components/request-access-modal";
import { ApiClientError, addCategory, deleteBook, getCategories, getStats, listBooks, setFavorite, updateBook } from "@/lib/api";
import type { Book, Stats } from "@/lib/types";
import { useT, type StringKey } from "@/lib/i18n";

type ViewMode = "grid" | "list";
type StatusFilter = "all" | "ready" | "processing" | "failed";
type SortKey = "recent" | "title" | "pages" | "chunks";

const STATUS_TABS: { key: StatusFilter; labelKey: StringKey }[] = [
  { key: "all", labelKey: "lib.statusAll" },
  { key: "ready", labelKey: "lib.statusReady" },
  { key: "processing", labelKey: "lib.statusProcessing" },
  { key: "failed", labelKey: "lib.statusFailed" }
];

const nf = new Intl.NumberFormat("en");

export default function LibraryPage() {
  const router = useRouter();
  const { token, user, isAdmin, loading: authLoading } = useAuth();
  const t = useT();
  const [books, setBooks] = useState<Book[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [view, setView] = useState<ViewMode>("grid");
  const [categoryList, setCategoryList] = useState<string[]>([]);
  const [pickerBook, setPickerBook] = useState<Book | null>(null);
  const [payBook, setPayBook] = useState<Book | null>(null);

  const refresh = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [bookResult, statsResult, catResult] = await Promise.all([
        listBooks(token),
        isAdmin ? getStats(token) : Promise.resolve(null),
        getCategories(token).catch(() => ({ categories: [] }))
      ]);
      setBooks(bookResult.books);
      setStats(statsResult);
      setCategoryList(catResult.categories);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t("lib.loadError"));
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
    if (!window.confirm(`${t("lib.deleteConfirm")}\n\n"${book.title}"`)) {
      return;
    }

    setDeletingId(book.id);
    setError("");

    try {
      await deleteBook(book.id, token);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t("lib.deleteError"));
    } finally {
      setDeletingId("");
    }
  }

  function setCategory(book: Book) {
    // Open the category picker (managed list + add new) instead of a free prompt.
    setPickerBook(book);
  }

  // Assign a category to the picker's book (empty string clears it).
  async function assignCategory(category: string) {
    const book = pickerBook;
    if (!book) {
      return;
    }
    setBooks((prev) => prev.map((item) => (item.id === book.id ? { ...item, category } : item)));
    setPickerBook(null);
    try {
      await updateBook(book.id, { category }, token);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t("lib.deleteError"));
      await refresh();
    }
  }

  // Add a new category to the managed list, then select it for the book.
  async function createAndAssignCategory(name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    try {
      const result = await addCategory(trimmed, token);
      setCategoryList(result.categories);
    } catch {
      // Even if the list call fails, still try to assign the typed value.
    }
    await assignCategory(trimmed);
  }

  async function setAuthor(book: Book) {
    const next = window.prompt(t("lib.authorPrompt"), book.author ?? "");
    if (next === null) {
      return;
    }
    try {
      await updateBook(book.id, { author: next.trim() }, token);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t("lib.deleteError"));
    }
  }

  // Admin: a short blurb the discovery assistant uses to recommend this book.
  async function setDescription(book: Book) {
    const next = window.prompt(t("lib.descriptionPrompt"), book.description ?? "");
    if (next === null) {
      return;
    }
    try {
      await updateBook(book.id, { description: next.trim() }, token);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t("lib.deleteError"));
    }
  }

  function openBook(book: Book) {
    // Locked books appear in the catalog but can't be opened until granted —
    // clicking one opens the payment / request-access popup instead.
    if (book.accessible === false) {
      setPayBook(book);
      return;
    }
    router.push(`/read/${book.id}`);
  }

  async function toggleFavorite(book: Book) {
    const next = !book.favorite;
    setBooks((prev) => prev.map((item) => (item.id === book.id ? { ...item, favorite: next } : item)));
    try {
      await setFavorite(book.id, next, token);
    } catch {
      setBooks((prev) => prev.map((item) => (item.id === book.id ? { ...item, favorite: !next } : item)));
    }
  }

  // Admin-only: curate which books appear in the homepage showcase carousel.
  async function toggleFeatured(book: Book) {
    const next = !book.featured;
    setBooks((prev) => prev.map((item) => (item.id === book.id ? { ...item, featured: next } : item)));
    try {
      await updateBook(book.id, { featured: next }, token);
    } catch {
      setBooks((prev) => prev.map((item) => (item.id === book.id ? { ...item, featured: !next } : item)));
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

  const categories = useMemo(() => {
    const set = new Set<string>(categoryList);
    for (const book of books) {
      if (book.category) {
        set.add(book.category);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [books, categoryList]);

  const visibleBooks = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = books.filter((book) => {
      if (statusFilter !== "all" && book.status !== statusFilter) {
        return false;
      }
      if (categoryFilter === "__none__" && book.category) {
        return false;
      }
      if (categoryFilter !== "all" && categoryFilter !== "__none__" && book.category !== categoryFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        book.title.toLowerCase().includes(query) ||
        book.originalFileName.toLowerCase().includes(query) ||
        (book.author ?? "").toLowerCase().includes(query) ||
        (book.category ?? "").toLowerCase().includes(query)
      );
    });

    return [...filtered].sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "pages") return b.pageCount - a.pageCount;
      if (sort === "chunks") return b.chunkCount - a.chunkCount;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [books, search, statusFilter, categoryFilter, sort]);

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
          {authLoading ? t("lib.checkingSession") : t("lib.redirecting")}
        </div>
      </div>
    );
  }

  const isFiltering = Boolean(search.trim()) || statusFilter !== "all" || categoryFilter !== "all";

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink dark:text-white">{t("lib.title")}</h1>
          <p className="mt-1.5 text-sm text-ink/55 dark:text-white/55">
            {loading ? (
              t("lib.loadingBooks")
            ) : (
              <>
                <span className="font-medium text-ink/70 dark:text-white/70">{nf.format(totals.books)}</span> {t("lib.statBooks")} ·{" "}
                <span className="font-medium text-ink/70 dark:text-white/70">{nf.format(totals.pages)}</span> {t("lib.statPages")} ·{" "}
                <span className="font-medium text-ink/70 dark:text-white/70">{nf.format(totals.chunks)}</span> {t("lib.statChunks")}
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
            <span className="hidden sm:inline">{t("lib.refresh")}</span>
          </button>
          {isAdmin ? (
            <Link
              href="/upload"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-moss px-4 text-sm font-medium text-white transition hover:bg-moss/90"
            >
              <Plus className="h-4 w-4" />
              {t("lib.upload")}
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
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35 dark:text-white/35" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("lib.searchPlaceholder")}
              className="h-10 w-full rounded-lg border border-line bg-white ps-9 pe-9 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-moss focus:ring-2 focus:ring-moss/15 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/35"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute end-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-ink/40 transition hover:bg-ink/5 hover:text-ink dark:text-white/40 dark:hover:bg-white/10"
                aria-label="Clear"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="h-10 max-w-[10rem] rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink/80 outline-none transition focus:border-moss dark:border-white/10 dark:bg-white/5 dark:text-white/80"
              aria-label={t("lib.category")}
            >
              <option value="all">{t("lib.allCategories")}</option>
              <option value="__none__">{t("lib.uncategorized")}</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-medium text-ink/80 outline-none transition focus:border-moss dark:border-white/10 dark:bg-white/5 dark:text-white/80"
              aria-label={t("lib.sortNewest")}
            >
              <option value="recent">{t("lib.sortNewest")}</option>
              <option value="title">{t("lib.sortTitle")}</option>
              <option value="pages">{t("lib.sortPages")}</option>
              <option value="chunks">{t("lib.sortChunks")}</option>
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
                {t(tab.labelKey)}
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
              {t("lib.showing")} {visibleBooks.length} {t("lib.of")} {books.length} {t("lib.statBooks")}
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
                  onSetCategory={() => setCategory(book)}
                  onSetAuthor={() => setAuthor(book)}
                  onSetDescription={() => setDescription(book)}
                  onToggleFavorite={() => toggleFavorite(book)}
                  onToggleFeatured={() => toggleFeatured(book)}
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
                  onSetCategory={() => setCategory(book)}
                  onSetAuthor={() => setAuthor(book)}
                  onSetDescription={() => setDescription(book)}
                  onToggleFavorite={() => toggleFavorite(book)}
                  onToggleFeatured={() => toggleFeatured(book)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <EmptyState
          filtering={isFiltering}
          isAdmin={isAdmin}
          onClear={() => {
            setSearch("");
            setStatusFilter("all");
            setCategoryFilter("all");
          }}
        />
      )}

      {pickerBook ? (
        <CategoryPickerModal
          book={pickerBook}
          categories={categories}
          onClose={() => setPickerBook(null)}
          onSelect={assignCategory}
          onCreate={createAndAssignCategory}
        />
      ) : null}

      {payBook ? (
        <RequestAccessModal
          books={[]}
          categories={categories}
          defaultTarget={{ type: "book", value: payBook.id, label: payBook.title }}
          onClose={() => setPayBook(null)}
          onSubmitted={() => setPayBook(null)}
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
  onDelete,
  onSetCategory,
  onSetAuthor,
  onSetDescription,
  onToggleFavorite,
  onToggleFeatured
}: {
  book: Book;
  isAdmin: boolean;
  deleting: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onSetCategory: () => void;
  onSetAuthor: () => void;
  onSetDescription: () => void;
  onToggleFavorite: () => void;
  onToggleFeatured: () => void;
}) {
  const t = useT();
  const locked = book.accessible === false;
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
      aria-disabled={locked}
      className={`group flex flex-col overflow-hidden rounded-2xl border border-line bg-white text-left transition focus:outline-none focus:ring-2 focus:ring-moss/25 dark:border-white/10 dark:bg-[#0c0c0e] ${
        locked ? "cursor-default opacity-95" : "cursor-pointer hover:border-moss/30 hover:shadow-soft"
      }`}
    >
      <div className="relative border-b border-line bg-paper p-4 dark:border-white/10 dark:bg-white/[0.03]">
        {locked ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 bg-white/55 backdrop-blur-[2px] dark:bg-[#0c0c0e]/55">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink/70 text-white dark:bg-white/15">
              <Lock className="h-4 w-4" />
            </span>
            <span className="text-[11px] font-medium text-ink/70 dark:text-white/70">{t("lib.lockedHint")}</span>
          </div>
        ) : (
          <div className="absolute start-3 top-3 z-10">
            <FavoriteButton favorite={Boolean(book.favorite)} onToggle={onToggleFavorite} />
          </div>
        )}
        {isAdmin ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            disabled={deleting}
            className="absolute end-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white/90 text-ink/50 opacity-0 backdrop-blur transition hover:border-red-300 hover:text-red-600 focus:opacity-100 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-[#0c0c0e]/80 dark:text-white/50 dark:hover:border-red-500/40 dark:hover:text-red-300"
            aria-label={`Delete ${book.title}`}
            title={`Delete ${book.title}`}
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        ) : null}
        <BookCover
          bookId={book.id}
          ready={book.status === "ready"}
          alt={book.title}
          className="mx-auto aspect-[3/4] max-h-64 w-full max-w-44 overflow-hidden rounded-md border border-black/[0.06] bg-white shadow-[8px_12px_26px_rgba(24,24,27,0.12)] transition group-hover:-translate-y-0.5 dark:border-black/10 dark:bg-paper"
          iconClassName="h-10 w-10"
        />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h2 dir="auto" className="line-clamp-2 text-[0.95rem] font-semibold leading-6 text-ink dark:text-white">
            {book.title}
          </h2>
          <p className="mt-1 truncate text-xs text-ink/45 dark:text-white/45">{book.originalFileName}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin ? <StatusBadge book={book} /> : null}
          <MetaControl
            value={book.author}
            icon={User}
            addLabel={t("lib.addAuthor")}
            editTitle={t("lib.author")}
            isAdmin={isAdmin}
            onEdit={onSetAuthor}
          />
          <MetaControl
            value={book.category}
            icon={Tag}
            addLabel={t("lib.addCategory")}
            editTitle={t("lib.category")}
            isAdmin={isAdmin}
            onEdit={onSetCategory}
          />
          {isAdmin ? <FeaturedToggle featured={Boolean(book.featured)} onToggle={onToggleFeatured} /> : null}
        </div>

        {book.description ? (
          <button
            type="button"
            dir="auto"
            onClick={(event) => {
              event.stopPropagation();
              if (isAdmin) onSetDescription();
            }}
            className={`line-clamp-2 text-start text-xs leading-5 text-ink/55 dark:text-white/55 ${isAdmin ? "hover:text-moss dark:hover:text-sea" : "cursor-default"}`}
          >
            {book.description}
          </button>
        ) : isAdmin ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSetDescription();
            }}
            className="inline-flex w-fit items-center gap-1 text-xs font-medium text-ink/40 transition hover:text-moss dark:text-white/40 dark:hover:text-sea"
          >
            <Plus className="h-3 w-3" />
            {t("lib.addDescription")}
          </button>
        ) : null}

        <div className="mt-auto flex items-center justify-between border-t border-line/70 pt-3 dark:border-white/10">
          <span className="text-xs text-ink/50 dark:text-white/50">
            {nf.format(book.pageCount)} {t("lib.pages")} · {nf.format(book.chunkCount)} {t("lib.chunks")}
          </span>
          {locked ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-ink/45 dark:text-white/45">
              {t("lib.locked")}
              <Lock className="h-3 w-3" />
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-moss transition group-hover:gap-1.5 dark:text-sea">
              {t("lib.openBook")}
              <BookOpenText className="h-3.5 w-3.5" />
            </span>
          )}
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
  onDelete,
  onSetCategory,
  onSetAuthor,
  onSetDescription,
  onToggleFavorite,
  onToggleFeatured
}: {
  book: Book;
  isAdmin: boolean;
  deleting: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onSetCategory: () => void;
  onSetAuthor: () => void;
  onSetDescription: () => void;
  onToggleFavorite: () => void;
  onToggleFeatured: () => void;
}) {
  const t = useT();
  const locked = book.accessible === false;
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
      aria-disabled={locked}
      className={`group flex items-center gap-4 px-4 py-3.5 transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-moss/25 ${
        locked ? "cursor-default" : "cursor-pointer hover:bg-paper dark:hover:bg-white/[0.03]"
      }`}
    >
      <div className="relative shrink-0">
        <BookCover
          bookId={book.id}
          ready={book.status === "ready"}
          alt={book.title}
          className="h-12 w-9 overflow-hidden rounded border border-line dark:border-white/10"
          iconClassName="h-4 w-4"
        />
        {locked ? (
          <span className="absolute inset-0 flex items-center justify-center rounded bg-ink/45 text-white">
            <Lock className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p dir="auto" className="truncate text-sm font-semibold text-ink dark:text-white">{book.title}</p>
        <p className="truncate text-xs text-ink/45 dark:text-white/45">{book.originalFileName}</p>
      </div>
      <div className="hidden shrink-0 items-center gap-2 sm:flex">
        <MetaControl
          value={book.author}
          icon={User}
          addLabel={t("lib.addAuthor")}
          editTitle={t("lib.author")}
          isAdmin={isAdmin}
          onEdit={onSetAuthor}
        />
        <MetaControl
          value={book.category}
          icon={Tag}
          addLabel={t("lib.addCategory")}
          editTitle={t("lib.category")}
          isAdmin={isAdmin}
          onEdit={onSetCategory}
        />
        {isAdmin ? <StatusBadge book={book} compact /> : null}
      </div>
      <div className="hidden w-28 shrink-0 text-end text-xs text-ink/55 dark:text-white/55 md:block">
        {nf.format(book.pageCount)} {t("lib.pages")}
      </div>
      <div className="hidden w-28 shrink-0 text-end text-xs text-ink/55 dark:text-white/55 md:block">
        {nf.format(book.chunkCount)} {t("lib.chunks")}
      </div>
      {isAdmin ? <FeaturedToggle featured={Boolean(book.featured)} onToggle={onToggleFeatured} compact /> : null}
      {locked ? null : <FavoriteButton favorite={Boolean(book.favorite)} onToggle={onToggleFavorite} />}
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
  const t = useT();
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-paper p-12 text-center dark:border-white/10 dark:bg-white/[0.02]">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-moss/10 text-moss dark:bg-sea/15 dark:text-sea">
        <BookOpenText className="h-6 w-6" />
      </span>
      {filtering ? (
        <>
          <p className="mt-4 text-sm font-semibold text-ink dark:text-white">{t("lib.noMatchTitle")}</p>
          <p className="mt-1 text-sm text-ink/50 dark:text-white/50">{t("lib.noMatchBody")}</p>
          <button
            type="button"
            onClick={onClear}
            className="mt-4 inline-flex h-9 items-center rounded-lg border border-line bg-white px-3.5 text-sm font-medium text-ink/70 transition hover:border-moss/40 hover:text-moss dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:text-sea"
          >
            {t("lib.clearFilters")}
          </button>
        </>
      ) : (
        <>
          <p className="mt-4 text-sm font-semibold text-ink dark:text-white">{t("lib.noBooksTitle")}</p>
          <p className="mt-1 max-w-xs text-sm text-ink/50 dark:text-white/50">
            {isAdmin ? t("lib.noBooksAdmin") : t("lib.noBooksUser")}
          </p>
          {isAdmin ? (
            <Link
              href="/upload"
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-moss px-4 text-sm font-medium text-white transition hover:bg-moss/90"
            >
              <Plus className="h-4 w-4" />
              {t("lib.uploadFirst")}
            </Link>
          ) : null}
        </>
      )}
    </div>
  );
}

function FavoriteButton({ favorite, onToggle }: { favorite: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={favorite}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-white/90 backdrop-blur transition dark:border-white/10 dark:bg-[#0c0c0e]/80 ${
        favorite
          ? "text-moss dark:text-sea"
          : "text-ink/40 hover:border-moss/40 hover:text-moss dark:text-white/40 dark:hover:text-sea"
      }`}
    >
      <Heart className={`h-4 w-4 ${favorite ? "fill-current" : ""}`} />
    </button>
  );
}

// Admin control to feature a book in the homepage showcase carousel.
function FeaturedToggle({ featured, onToggle, compact = false }: { featured: boolean; onToggle: () => void; compact?: boolean }) {
  const t = useT();
  if (compact) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        aria-pressed={featured}
        title={t("lib.featureHome")}
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ${
          featured
            ? "text-copper"
            : "text-ink/40 hover:bg-copper/10 hover:text-copper dark:text-white/40"
        }`}
      >
        <Sparkles className={`h-4 w-4 ${featured ? "fill-current" : ""}`} />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      aria-pressed={featured}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
        featured
          ? "border-copper/30 bg-copper/10 text-copper"
          : "border-dashed border-line text-ink/45 hover:border-copper/40 hover:text-copper dark:border-white/10 dark:text-white/45"
      }`}
    >
      <Sparkles className={`h-3 w-3 ${featured ? "fill-current" : ""}`} />
      {featured ? t("lib.featured") : t("lib.featureHome")}
    </button>
  );
}

function CategoryPickerModal({
  book,
  categories,
  onClose,
  onSelect,
  onCreate
}: {
  book: Book;
  categories: string[];
  onClose: () => void;
  onSelect: (category: string) => void;
  onCreate: (name: string) => void;
}) {
  const t = useT();
  const [newName, setNewName] = useState("");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-[#0c0c0e]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-ink dark:text-white">{t("lib.category")}</h3>
            <p dir="auto" className="truncate text-xs text-ink/45 dark:text-white/45">{book.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink/40 transition hover:bg-ink/5 hover:text-ink dark:text-white/40 dark:hover:bg-white/10"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-60 space-y-1 overflow-y-auto">
          <CategoryOption label={t("lib.uncategorized")} active={!book.category} onClick={() => onSelect("")} />
          {categories.map((category) => (
            <CategoryOption
              key={category}
              label={category}
              active={book.category === category}
              onClick={() => onSelect(category)}
            />
          ))}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            onCreate(newName);
            setNewName("");
          }}
          className="mt-4 flex items-center gap-2 border-t border-line/70 pt-4 dark:border-white/10"
        >
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder={t("lib.newCategory")}
            maxLength={80}
            className="h-9 flex-1 rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-moss focus:ring-2 focus:ring-moss/15 dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
          <button
            type="submit"
            disabled={!newName.trim()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-moss px-3 text-sm font-medium text-white transition hover:bg-moss/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {t("lib.add")}
          </button>
        </form>
      </div>
    </div>
  );
}

function CategoryOption({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      dir="auto"
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm transition ${
        active
          ? "bg-moss/10 font-medium text-moss dark:bg-sea/15 dark:text-sea"
          : "text-ink/70 hover:bg-ink/5 dark:text-white/70 dark:hover:bg-white/10"
      }`}
    >
      <Tag className="h-3.5 w-3.5 shrink-0 opacity-70" />
      {label}
    </button>
  );
}

function MetaControl({
  value,
  isAdmin,
  onEdit,
  icon: Icon,
  addLabel,
  editTitle
}: {
  value: string;
  isAdmin: boolean;
  onEdit: () => void;
  icon: typeof Tag;
  addLabel: string;
  editTitle: string;
}) {
  if (!value && !isAdmin) {
    return null;
  }

  const handleClick = (event: React.MouseEvent) => {
    if (!isAdmin) {
      return;
    }
    event.stopPropagation();
    onEdit();
  };

  if (value) {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={!isAdmin}
        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-1 text-xs font-medium text-ink/60 transition enabled:hover:border-moss/40 enabled:hover:text-moss disabled:cursor-default dark:border-white/10 dark:bg-white/5 dark:text-white/60 dark:enabled:hover:text-sea"
        title={isAdmin ? editTitle : undefined}
      >
        <Icon className="h-3 w-3" />
        {value}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-2.5 py-1 text-xs font-medium text-ink/45 transition hover:border-moss/40 hover:text-moss dark:border-white/10 dark:text-white/45 dark:hover:text-sea"
    >
      <Icon className="h-3 w-3" />
      {addLabel}
    </button>
  );
}

function StatusBadge({ book, compact = false }: { book: Book; compact?: boolean }) {
  const t = useT();
  if (book.status === "failed") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
        title={book.error || undefined}
      >
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        {compact ? t("lib.failedShort") : t("lib.failedBadge")}
      </span>
    );
  }

  if (book.status === "processing") {
    const label = book.pageCount
      ? `${t("lib.processingOf")} ${book.processedPages}/${book.pageCount}`
      : t("lib.processingShort");
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300">
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
        {compact ? t("lib.processingShort") : label}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-moss/20 bg-moss/[0.06] px-2.5 py-1 text-xs font-medium text-moss dark:border-sea/25 dark:bg-sea/10 dark:text-sea">
      <span className="h-1.5 w-1.5 rounded-full bg-moss dark:bg-sea" />
      {t("lib.ready")}
    </span>
  );
}
