"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, FileText, Loader2, Quote, RotateCcw, ThumbsDown } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { listFeedback, setFeedbackResolved, type FeedbackItem } from "@/lib/api";
import { useLang } from "@/lib/i18n";

type Tab = "needsReview" | "resolved" | "all";

const TAB_PARAMS: Record<Tab, { resolved?: boolean }> = {
  needsReview: { resolved: false },
  resolved: { resolved: true },
  all: {}
};

export default function FeedbackPage() {
  const router = useRouter();
  const { token, isAdmin, loading: authLoading } = useAuth();
  const { t } = useLang();
  const [tab, setTab] = useState<Tab>("needsReview");
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const result = await listFeedback(token, { vote: "down", ...TAB_PARAMS[tab] });
      setItems(result.items);
      setCursor(result.nextCursor);
    } catch {
      setItems([]);
      setCursor(null);
    } finally {
      setLoading(false);
    }
  }, [token, tab]);

  const loadMore = useCallback(async () => {
    if (!token || !cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await listFeedback(token, { vote: "down", ...TAB_PARAMS[tab], cursor });
      setItems((prev) => [...prev, ...result.items]);
      setCursor(result.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [token, tab, cursor, loadingMore]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) {
      router.replace("/");
      return;
    }
    refresh();
  }, [authLoading, isAdmin, refresh, router]);

  async function toggleResolved(item: FeedbackItem) {
    setBusyId(item.id);
    try {
      await setFeedbackResolved(item.id, !item.resolved, token);
      // Optimistically drop/update in place instead of a full refetch so the
      // admin's scroll position and remaining queue stay put.
      setItems((prev) =>
        tab === "all"
          ? prev.map((row) => (row.id === item.id ? { ...row, resolved: !row.resolved } : row))
          : prev.filter((row) => row.id !== item.id)
      );
    } finally {
      setBusyId("");
    }
  }

  if (authLoading || !isAdmin) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-ink/70 dark:text-white/70">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const emptyKey = (tab === "needsReview" ? "fb.emptyNeedsReview" : tab === "resolved" ? "fb.emptyResolved" : "fb.emptyAll") as never;

  return (
    <div className="mx-auto max-w-3xl py-2">
      <header className="mb-5 flex items-center gap-2">
        <ThumbsDown className="h-5 w-5 text-moss dark:text-sea" />
        <div>
          <h1 className="text-lg font-bold text-ink dark:text-white">{t("fb.title")}</h1>
          <p className="mt-0.5 text-sm text-ink/70 dark:text-white/70">{t("fb.subtitle")}</p>
        </div>
      </header>

      <div className="mb-4 flex gap-2">
        {(["needsReview", "resolved", "all"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              tab === value
                ? "bg-moss text-white"
                : "border border-line text-ink/70 hover:text-moss dark:border-white/10 dark:text-white/70"
            }`}
          >
            {t(`fb.${value}` as never)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-ink/70">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-line bg-white py-14 text-center dark:border-white/10 dark:bg-[#0c0c0e]">
          <CheckCircle2 className="h-6 w-6 text-moss dark:text-sea" />
          <p className="text-sm text-ink/70 dark:text-white/70">{t(emptyKey)}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <FeedbackCard
              key={item.id}
              item={item}
              busy={busyId === item.id}
              onToggleResolved={() => toggleResolved(item)}
            />
          ))}
        </ul>
      )}

      {cursor ? (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink/70 transition hover:text-moss disabled:opacity-50 dark:border-white/10 dark:text-white/70"
          >
            {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("common.loadMore")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

const ANSWER_PREVIEW_LENGTH = 260;

function FeedbackCard({
  item,
  busy,
  onToggleResolved
}: {
  item: FeedbackItem;
  busy: boolean;
  onToggleResolved: () => void;
}) {
  const { t, lang } = useLang();
  const [expanded, setExpanded] = useState(false);
  const isLong = item.answer.length > ANSWER_PREVIEW_LENGTH;
  const answerText = expanded || !isLong ? item.answer : `${item.answer.slice(0, ANSWER_PREVIEW_LENGTH)}…`;

  return (
    <li className="rounded-xl border border-line bg-white p-4 dark:border-white/10 dark:bg-[#0c0c0e]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-red-500">
          <ThumbsDown className="h-3.5 w-3.5" />
          {t("fb.disliked")}
        </div>
        <div className="flex items-center gap-2 text-xs text-ink/70 dark:text-white/70">
          <span>{formatDate(item.createdAt, lang)}</span>
          {item.resolved ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-moss/10 px-2 py-0.5 font-medium text-moss dark:bg-sea/15 dark:text-sea">
              <CheckCircle2 className="h-3 w-3" />
              {t("fb.resolved")}
            </span>
          ) : null}
        </div>
      </div>

      {item.note ? (
        <p dir="auto" className="mt-3 rounded-lg border-s-2 border-red-300 bg-red-50/60 px-3 py-2 text-sm text-ink dark:border-red-500/40 dark:bg-red-500/5 dark:text-white">
          “{item.note}”
        </p>
      ) : (
        <p className="mt-3 text-sm italic text-ink/50 dark:text-white/50">{t("fb.noNote")}</p>
      )}

      {item.question ? (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink/50 dark:text-white/50">
            {t("fb.question")}
          </p>
          <p dir="auto" className="mt-1 text-sm text-ink/80 dark:text-white/80">
            {item.question}
          </p>
        </div>
      ) : null}

      {item.answer ? (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink/50 dark:text-white/50">
            {t("fb.answer")}
          </p>
          <p dir="auto" className="mt-1 whitespace-pre-wrap text-sm text-ink/70 dark:text-white/70">
            {answerText}
          </p>
          {isLong ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-xs font-medium text-moss hover:underline dark:text-sea"
            >
              {expanded ? t("fb.showLess") : t("fb.showMore")}
            </button>
          ) : null}
        </div>
      ) : null}

      <FeedbackEvidence sources={item.sources} evidence={item.evidence} />

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          disabled={busy}
          onClick={onToggleResolved}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
            item.resolved
              ? "border border-line text-ink/70 hover:text-ink dark:border-white/10 dark:text-white/70"
              : "bg-moss text-white hover:bg-moss/90"
          }`}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : item.resolved ? (
            <RotateCcw className="h-3.5 w-3.5" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          {item.resolved ? t("fb.markUnresolved") : t("fb.markResolved")}
        </button>
      </div>
    </li>
  );
}

// Lets an admin tell a retrieval miss (evidence was wrong/irrelevant) apart
// from a generation miss (evidence was fine, the model just answered badly).
function FeedbackEvidence({ sources, evidence }: { sources: FeedbackItem["sources"]; evidence: FeedbackItem["evidence"] }) {
  const { t } = useLang();
  if (!sources.length && !evidence.length) {
    return <p className="mt-3 text-xs italic text-ink/50 dark:text-white/50">{t("fb.noEvidence")}</p>;
  }

  return (
    <details className="group mt-3 rounded-lg border border-line dark:border-white/10" open={sources.length > 0}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-ink/80 transition hover:text-moss dark:text-white/80 dark:hover:text-sea">
        <span className="flex items-center gap-1.5">
          <Quote className="h-3.5 w-3.5" />
          {t("ask.evidence")}
          <span className="rounded-full bg-moss/10 px-1.5 py-0.5 text-[11px] font-bold text-moss dark:bg-sea/15 dark:text-sea">
            {Math.max(sources.length, evidence.length)}
          </span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
      </summary>

      <div className="space-y-2 border-t border-line p-2.5 dark:border-white/10">
        {sources.map((source, index) => (
          <div key={`src-${index}`} className="rounded-md bg-paper p-2.5 dark:bg-white/5">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-ink/70 dark:text-white/70">
              <span className="truncate">{source.bookName}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-moss/10 px-1.5 py-0.5 text-moss dark:bg-sea/15 dark:text-sea">
                <FileText className="h-3 w-3" />
                {t("ask.page")} {source.pageNumber}
              </span>
            </div>
            {source.supportingText ? (
              <p dir="auto" className="mt-1.5 text-xs text-ink/70 dark:text-white/70">
                {source.supportingText}
              </p>
            ) : null}
          </div>
        ))}

        {evidence.length ? (
          <details className="group/ev rounded-md border border-dashed border-line dark:border-white/10">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink/70 dark:text-white/70">
              {t("ask.rawChunks")} ({evidence.length})
              <ChevronDown className="h-3 w-3 transition group-open/ev:rotate-180" />
            </summary>
            <div className="space-y-2 border-t border-line p-2.5 dark:border-white/10">
              {evidence.map((chunk, index) => (
                <div key={`ev-${index}`} className="rounded-md bg-paper p-2.5 dark:bg-white/5">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-ink/70 dark:text-white/70">
                    <span className="truncate">{chunk.bookName}</span>
                    <span>
                      {t("ask.page")} {chunk.pageNumber}
                    </span>
                    {typeof chunk.score === "number" ? (
                      <span className="text-ink/50 dark:text-white/50">· {Math.round(chunk.score * 100) / 100}</span>
                    ) : null}
                  </div>
                  {chunk.chunkText ? (
                    <p dir="auto" className="mt-1.5 text-xs text-ink/70 dark:text-white/70">
                      {chunk.chunkText}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </details>
  );
}

function formatDate(value: string, lang: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}
