"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, BookOpenText, CheckCircle2, Clock, Loader2, Lock, Sparkles } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { RequestAccessModal } from "@/components/request-access-modal";
import {
  bookCoverUrl,
  discoverBooks,
  getCategories,
  listAccessRequests,
  type AccessRequest,
  type DiscoveryBook
} from "@/lib/api";
import { useT } from "@/lib/i18n";

type RequestTarget = { type: "book" | "category"; value: string; label: string };

/**
 * Shown to signed-in users who don't have library access yet. They can ask the
 * AI which books / categories suit them (metadata only — no content), then
 * request access to what they want.
 */
export function DiscoveryExperience() {
  const { token } = useAuth();
  const t = useT();
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState("");
  const [books, setBooks] = useState<DiscoveryBook[]>([]);
  const [asked, setAsked] = useState(false);

  const [categories, setCategories] = useState<string[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [modalTarget, setModalTarget] = useState<RequestTarget | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const suggestions = [t("discover.s1"), t("discover.s2"), t("discover.s3")];

  const refreshRequests = () => {
    listAccessRequests(token)
      .then((r) => setRequests(r.requests))
      .catch(() => undefined);
  };

  useEffect(() => {
    getCategories(token)
      .then((r) => setCategories(r.categories))
      .catch(() => undefined);
    refreshRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Books/categories that already have a pending request (so we can show status).
  const pendingValues = new Set(requests.filter((r) => r.status === "pending").map((r) => r.targetValue));

  function openRequest(target?: RequestTarget) {
    setModalTarget(target ?? null);
    setModalOpen(true);
  }

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) {
      return;
    }
    setBusy(true);
    setAsked(true);
    setAnswer("");
    setBooks([]);
    try {
      const result = await discoverBooks(q, token);
      setAnswer(result.answer);
      setBooks(result.books);
    } catch {
      setAnswer(t("discover.error"));
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    ask(question);
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col px-2 py-10">
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1 text-xs font-medium text-ink/70 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
          <Sparkles className="h-3.5 w-3.5 text-moss dark:text-sea" />
          {t("discover.badge")}
        </span>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-ink dark:text-white sm:text-3xl">
          {t("discover.title")}
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-ink/70 dark:text-white/70">{t("discover.subtitle")}</p>
      </div>

      <form onSubmit={onSubmit} className="mt-7">
        <div className="flex items-center gap-2 rounded-2xl border border-line bg-white p-2 shadow-soft focus-within:border-moss/50 dark:border-white/10 dark:bg-[#0c0c0e]">
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={t("discover.placeholder")}
            dir="auto"
            className="h-10 flex-1 bg-transparent px-3 text-sm text-ink outline-none placeholder:text-ink/35 dark:text-white dark:placeholder:text-white/35"
          />
          <button
            type="submit"
            disabled={busy || !question.trim()}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-moss px-4 text-sm font-semibold text-white transition hover:bg-moss/90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeft className="h-4 w-4 ltr:rotate-180" />}
            {t("discover.ask")}
          </button>
        </div>
      </form>

      {!asked ? (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setQuestion(s);
                ask(s);
              }}
              dir="auto"
              className="rounded-full border border-line bg-white px-3 py-1.5 text-xs text-ink/70 transition hover:border-moss/40 hover:text-moss dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:text-sea"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      {answer ? (
        <div className="mt-7 rounded-2xl border border-line bg-white p-5 dark:border-white/10 dark:bg-[#0c0c0e]">
          <p dir="auto" className="whitespace-pre-wrap text-sm leading-7 text-ink dark:text-white/90">
            {answer}
          </p>
        </div>
      ) : null}

      {books.length ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {books.map((book) => (
            <DiscoveryCard
              key={book.id}
              book={book}
              pending={pendingValues.has(book.id)}
              onRequest={() => openRequest({ type: "book", value: book.id, label: book.title })}
            />
          ))}
        </div>
      ) : null}

      {asked && !busy ? (
        <div className="mt-6 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => openRequest()}
            className="inline-flex items-center gap-2 rounded-lg border border-moss/30 bg-moss/10 px-4 py-2 text-sm font-semibold text-moss transition hover:bg-moss/15 dark:border-sea/30 dark:bg-sea/15 dark:text-sea"
          >
            <Lock className="h-4 w-4" />
            {t("req.requestAccess")}
          </button>
          <p className="text-center text-xs text-ink/70 dark:text-white/70">{t("discover.requestHint")}</p>
        </div>
      ) : null}

      {requests.length ? (
        <div className="mt-8 border-t border-line/70 pt-5 dark:border-white/10">
          <h3 className="mb-3 text-xs font-semibold text-ink/70 dark:text-white/70">{t("req.myRequests")}</h3>
          <ul className="space-y-2">
            {requests.slice(0, 6).map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
              >
                <span dir="auto" className="min-w-0 truncate text-ink/80 dark:text-white/80">
                  {r.targetType === "category" ? "📂 " : "📘 "}
                  {r.targetLabel || r.targetValue}
                </span>
                <RequestStatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {modalOpen ? (
        <RequestAccessModal
          books={books}
          categories={categories}
          defaultTarget={modalTarget ?? undefined}
          onClose={() => setModalOpen(false)}
          onSubmitted={() => {
            setModalOpen(false);
            refreshRequests();
          }}
        />
      ) : null}
    </div>
  );
}

function RequestStatusBadge({ status }: { status: AccessRequest["status"] }) {
  const t = useT();
  if (status === "approved") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-moss dark:text-sea">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {t("req.approved")}
      </span>
    );
  }
  if (status === "rejected") {
    return <span className="shrink-0 text-xs font-medium text-red-500">{t("req.rejected")}</span>;
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-amber-500">
      <Clock className="h-3.5 w-3.5" />
      {t("req.pending")}
    </span>
  );
}

function DiscoveryCard({ book, pending, onRequest }: { book: DiscoveryBook; pending: boolean; onRequest: () => void }) {
  const [failed, setFailed] = useState(false);
  const t = useT();
  return (
    <div className="flex gap-3 rounded-xl border border-line bg-white p-3 dark:border-white/10 dark:bg-white/5">
      <div className="h-20 w-14 shrink-0 overflow-hidden rounded-md bg-moss/10 dark:bg-sea/15">
        {failed ? (
          <span className="flex h-full w-full items-center justify-center text-moss dark:text-sea">
            <BookOpenText className="h-5 w-5" />
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bookCoverUrl(book.id)}
            alt={book.title}
            loading="lazy"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <p dir="auto" className="line-clamp-2 text-sm font-semibold text-ink dark:text-white">
          {book.title}
        </p>
        {book.category ? (
          <span className="mt-1 inline-block w-fit rounded-full bg-moss/10 px-2 py-0.5 text-[11px] font-medium text-moss dark:bg-sea/15 dark:text-sea">
            {book.category}
          </span>
        ) : null}
        <div className="mt-auto pt-2">
          {pending ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-500">
              <Clock className="h-3 w-3" />
              {t("req.pending")}
            </span>
          ) : (
            <button
              type="button"
              onClick={onRequest}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-moss transition hover:gap-1.5 dark:text-sea"
            >
              <Lock className="h-3 w-3" />
              {t("req.requestAccess")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
