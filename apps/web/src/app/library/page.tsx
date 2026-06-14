"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, BookOpenText, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { AdminKeyField } from "@/components/admin-key-field";
import { useAdminKey } from "@/hooks/use-admin-key";
import { ApiClientError, deleteBook, getStats, listBooks } from "@/lib/api";
import type { Book, Stats } from "@/lib/types";

export default function LibraryPage() {
  const { adminKey } = useAdminKey();
  const [books, setBooks] = useState<Book[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [bookResult, statsResult] = await Promise.all([
        listBooks(),
        getStats(adminKey).catch((err) => {
          if (err instanceof ApiClientError && err.status === 401) {
            return null;
          }
          throw err;
        })
      ]);
      setBooks(bookResult.books);
      setStats(statsResult);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not load the library.");
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function removeBook(book: Book) {
    if (!window.confirm(`Delete "${book.title}" and all of its chunks?`)) {
      return;
    }

    setDeletingId(book.id);
    setError("");

    try {
      await deleteBook(book.id, adminKey);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not delete this book.");
    } finally {
      setDeletingId("");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="border border-line bg-white shadow-soft dark:border-white/10 dark:bg-white/8">
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
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              Loading library...
            </div>
          ) : books.length ? (
            <div className="overflow-hidden rounded-md border border-line dark:border-white/10">
              <div className="grid grid-cols-[minmax(0,1fr)_110px_110px_64px] gap-3 border-b border-line bg-paper px-4 py-3 text-xs font-semibold uppercase text-ink/55 dark:border-white/10 dark:bg-ink/60 dark:text-white/55">
                <span>Book</span>
                <span>Pages</span>
                <span>Chunks</span>
                <span className="text-left">Delete</span>
              </div>
              {books.map((book) => (
                <div
                  key={book.id}
                  className="grid grid-cols-[minmax(0,1fr)_110px_110px_64px] items-center gap-3 border-b border-line px-4 py-4 last:border-b-0 dark:border-white/10"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink dark:text-white">{book.title}</p>
                    <p className="mt-1 truncate text-xs text-ink/50 dark:text-white/45">
                      {book.originalFileName} - {new Date(book.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-sm text-ink/65 dark:text-white/65">{book.pageCount}</span>
                  <span className="text-sm text-ink/65 dark:text-white/65">{book.chunkCount}</span>
                  <button
                    type="button"
                    onClick={() => removeBook(book)}
                    disabled={deletingId === book.id}
                    className="mr-auto inline-flex h-9 w-9 items-center justify-center rounded-md border border-line text-red-700 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10"
                    aria-label={`Delete ${book.title}`}
                    title={`Delete ${book.title}`}
                  >
                    {deletingId === book.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
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

      <aside className="space-y-5 border border-line bg-white p-5 shadow-soft dark:border-white/10 dark:bg-white/8">
        <AdminKeyField />
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
              : "Enter an admin key to view protected usage metrics."}
          </p>
        </div>
      </aside>
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
