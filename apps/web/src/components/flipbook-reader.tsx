"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { ApiClientError, getBookHeyzine } from "@/lib/api";
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

/** Heyzine owns the reader UI and page effect. No local page-turn engine. */
export function FlipbookReader({ bookId, title, kind }: FlipbookReaderProps) {
  const { token } = useAuth();
  const t = useT();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setUrl("");
    setError("");
    if (kind !== "pdf") {
      setError("Heyzine currently supports PDF books only.");
      return () => { cancelled = true; };
    }
    getBookHeyzine(bookId, token)
      .then((result) => { if (!cancelled) setUrl(result.url); })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiClientError ? err.message : t("read.notFound"));
      });
    return () => { cancelled = true; };
  }, [bookId, kind, t, token]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-100 dark:bg-[#08080a]">
      {error ? (
        <div className="flex h-full items-center justify-center p-6 text-center text-sm text-red-600 dark:text-red-300">
          <AlertCircle className="me-2 h-4 w-4 shrink-0" />{error}
        </div>
      ) : url ? (
        <iframe
          title={title}
          src={url}
          className="h-full min-h-0 w-full border-0"
          allow="fullscreen; clipboard-write"
          allowFullScreen
        />
      ) : (
        <div className="flex h-full items-center justify-center text-ink/60 dark:text-white/60">
          <Loader2 className="me-2 h-5 w-5 animate-spin" />{t("read.opening")}
        </div>
      )}
    </div>
  );
}
