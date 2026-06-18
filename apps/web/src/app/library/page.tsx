"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, BookOpenText, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { ApiClientError, deleteBook, getStats, listBooks } from "@/lib/api";
import type { Book, Stats } from "@/lib/types";

export default function LibraryPage() {
  const router = useRouter();
  const { token, user, isAdmin, loading: authLoading } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState("");

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

  if (authLoading || !user) {
    return (
      <div className="mx-auto max-w-xl border border-line bg-white p-6 shadow-soft dark:border-white/10 dark:bg-ink/85">
        <div className="flex items-center gap-3 text-sm font-medium text-ink/65 dark:text-white/70">
          <Loader2 className="h-4 w-4 animate-spin" />
          {authLoading ? "Checking your session..." : "Redirecting to sign in..."}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="border border-line bg-white shadow-soft dark:border-white/10 dark:bg-ink/85">
        <div className="flex items-center justify-between bg-gradient-to-b from-[#74b66f] to-moss px-5 py-4 text-white">
          <div>
            <p className="text-xs font-semibold text-white/80">Content management</p>
            <h1 className="mt-1 text-xl font-semibold">Library</h1>
          </div>
          <button
            type="button"
            onClick={refresh}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-moss/45 px-4 text-sm font-semibold text-white shadow-inner transition hover:bg-moss/65"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <div className="p-5 sm:p-6">
          {error ? (
            <div className="mb-4 flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          ) : null}

          {loading ? (
            <div className="flex min-h-56 items-center justify-center rounded-md border border-line bg-paper text-sm text-ink/60 dark:border-white/10 dark:bg-ink/60 dark:text-white/60">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading library...
            </div>
          ) : books.length ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {books.map((book) => (
                <article
                  key={book.id}
                  className="group overflow-hidden rounded-md border border-line bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft dark:border-white/10 dark:bg-[#111a14]"
                >
                  <div className="relative border-b border-line bg-[#f6f1e3] p-4 dark:border-white/10 dark:bg-[#1d2a20]">
                    {isAdmin ? (
                      <button
                        type="button"
                        onClick={() => removeBook(book)}
                        disabled={deletingId === book.id}
                        className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-md border border-line bg-white text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-ink dark:text-red-300 dark:hover:bg-red-500/10"
                        aria-label={`Delete ${book.title}`}
                        title={`Delete ${book.title}`}
                      >
                        {deletingId === book.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    ) : null}
                    <div className="mx-auto flex aspect-[3/4] max-h-72 w-full max-w-48 flex-col rounded-sm border border-black/10 bg-white p-5 shadow-[10px_14px_24px_rgba(38,50,56,0.18)] dark:border-white/10 dark:bg-paper">
                      <div className="h-2 w-16 bg-copper" />
                      <p className="mt-5 line-clamp-5 text-xs leading-5 text-ink/65">
                        {book.firstPageText || "First page preview will appear here after text is extracted."}
                      </p>
                      <div className="mt-auto space-y-2">
                        <div className="h-1.5 w-full rounded bg-moss/15" />
                        <div className="h-1.5 w-2/3 rounded bg-moss/15" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 p-4">
                    <div>
                      <h2 className="line-clamp-2 text-base font-semibold leading-6 text-ink dark:text-white">{book.title}</h2>
                      <p className="mt-1 truncate text-xs text-ink/45 dark:text-white/45">{book.originalFileName}</p>
                    </div>
                    <dl className="grid grid-cols-3 gap-2 text-sm">
                      <BookStat label="Pages" value={book.pageCount} />
                      <BookStat label="Chunks" value={book.chunkCount} />
                      <BookStat label="Author" value={book.author} />
                    </dl>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="flex min-h-56 flex-col items-center justify-center rounded-md border border-line bg-paper p-8 text-center dark:border-white/10 dark:bg-ink/60">
              <BookOpenText className="h-9 w-9 text-ink/35 dark:text-white/35" />
              <p className="mt-3 text-sm font-semibold text-ink dark:text-white">No books uploaded yet</p>
              <p className="mt-1 text-sm text-ink/55 dark:text-white/55">Upload a PDF to start building the knowledge base.</p>
            </div>
          )}
        </div>
      </section>

      <aside className="space-y-5 border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-ink/85">
        <div>
          <h2 className="text-base font-semibold text-ink dark:text-white">Access</h2>
          {isAdmin ? (
            <p className="mt-2 rounded-md border border-moss/20 bg-moss/10 p-3 text-sm text-moss dark:border-sea/25 dark:bg-sea/10 dark:text-sea">
              Signed in as admin. You can delete books and view usage metrics.
            </p>
          ) : (
            <p className="mt-2 rounded-md border border-line bg-paper p-3 text-sm text-ink/65 dark:border-white/10 dark:bg-white/5 dark:text-white/65">
              You can browse the library. Admin access is required for deletion and stats.
            </p>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Books" value={stats?.totalBooks ?? books.length} />
          <Stat label="Pages" value={stats?.totalPages ?? books.reduce((total, book) => total + book.pageCount, 0)} />
          <Stat label="Chunks" value={stats?.totalChunks ?? books.reduce((total, book) => total + book.chunkCount, 0)} />
        </div>
        <div className="rounded-md border border-line bg-paper p-4 dark:border-white/10 dark:bg-ink/60">
          <h2 className="text-sm font-semibold text-ink dark:text-white">Usage metrics</h2>
          <p className="mt-2 text-sm text-ink/60 dark:text-white/60">
            {stats
              ? `${stats.usage.chat?.total ?? 0} chat requests and ${stats.usage.upload?.total ?? 0} uploads tracked.`
              : "Admin sign-in is required to view protected usage metrics."}
          </p>
        </div>
      </aside>
    </div>
  );
}

function BookStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-line bg-paper p-2 dark:border-white/10 dark:bg-white/5">
      <dt className="text-[11px] font-semibold uppercase text-ink/45 dark:text-white/45">{label}</dt>
      <dd className="mt-1 truncate text-sm font-semibold text-ink dark:text-white">{value}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-line bg-paper p-3 text-center dark:border-white/10 dark:bg-ink/60">
      <p className="text-lg font-semibold text-ink dark:text-white">{value}</p>
      <p className="mt-1 text-xs uppercase text-ink/50 dark:text-white/45">{label}</p>
    </div>
  );
}
