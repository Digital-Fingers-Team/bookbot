"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { searchBookCatalog, type CatalogBook } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { useT } from "@/lib/i18n";

/**
 * Searchable, server-paginated book picker. Replaces a full-catalog <select>
 * so it scales to thousands of books — only ~20 matches are fetched per query.
 * `excludeIds` hides books already granted/selected.
 */
export function BookPicker({
  onPick,
  excludeIds = [],
  placeholder,
  autoFocus = false,
  size = "md"
}: {
  onPick: (book: CatalogBook) => void;
  excludeIds?: string[];
  placeholder?: string;
  autoFocus?: boolean;
  size?: "sm" | "md";
}) {
  const { token } = useAuth();
  const t = useT();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogBook[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const { books } = await searchBookCatalog(query.trim(), token, 20);
        if (!cancelled) setResults(books);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, token]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const exclude = new Set(excludeIds);
  const visible = results.filter((book) => !exclude.has(book.id));
  const inputHeight = size === "sm" ? "h-9" : "h-10";

  return (
    <div ref={boxRef} className="relative">
      <div
        className={`flex items-center gap-2 rounded-lg border border-line bg-white px-3 dark:border-white/10 dark:bg-white/5 ${inputHeight}`}
      >
        <Search className="h-4 w-4 shrink-0 text-ink/40" />
        <input
          value={query}
          autoFocus={autoFocus}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setOpen(true)}
          dir="auto"
          placeholder={placeholder ?? t("picker.searchBooks")}
          className="h-full flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink/35 dark:text-white"
        />
        {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ink/30" /> : null}
      </div>

      {open ? (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-line bg-white py-1 shadow-soft dark:border-white/10 dark:bg-[#161618]">
          {loading && visible.length === 0 ? (
            <p className="px-3 py-2 text-xs text-ink/45 dark:text-white/45">{t("picker.searching")}</p>
          ) : visible.length === 0 ? (
            <p className="px-3 py-2 text-xs text-ink/45 dark:text-white/45">
              {query.trim() ? t("picker.noResults") : t("picker.typeToSearch")}
            </p>
          ) : (
            visible.map((book) => (
              <button
                key={book.id}
                type="button"
                dir="auto"
                onClick={() => {
                  onPick(book);
                  setQuery("");
                  setOpen(false);
                }}
                className="flex w-full flex-col items-start px-3 py-1.5 text-start transition hover:bg-moss/[0.06] dark:hover:bg-white/5"
              >
                <span className="line-clamp-1 text-sm text-ink dark:text-white">{book.title}</span>
                {book.author || book.category ? (
                  <span className="line-clamp-1 text-[11px] text-ink/45 dark:text-white/45">
                    {[book.author, book.category].filter(Boolean).join(" · ")}
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
