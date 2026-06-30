"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  BarChart3,
  BookOpenText,
  CheckCircle2,
  FileText,
  HelpCircle,
  Inbox,
  Layers,
  Loader2,
  Lock,
  MessageSquareText,
  ThumbsUp,
  TrendingUp,
  UploadCloud,
  Wallet,
  XCircle
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { ApiClientError, getStats } from "@/lib/api";
import type { Stats } from "@/lib/types";
import { useT } from "@/lib/i18n";

const nf = new Intl.NumberFormat("en");

export default function AnalyticsPage() {
  const router = useRouter();
  const { token, user, isAdmin, loading: authLoading } = useAuth();
  const t = useT();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      setStats(await getStats(token));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t("an.loadError"));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!user) {
      router.replace("/login?next=/analytics");
      return;
    }
    if (isAdmin) {
      load();
    } else {
      setLoading(false);
    }
  }, [authLoading, user, isAdmin, load, router]);

  if (authLoading || !user) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-line bg-white p-6 dark:border-white/10 dark:bg-[#0c0c0e]">
        <div className="flex items-center gap-3 text-sm font-medium text-ink/60 dark:text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("lib.checkingSession")}
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-line bg-white p-8 text-center dark:border-white/10 dark:bg-[#0c0c0e]">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">
          <Lock className="h-6 w-6" />
        </span>
        <p className="mt-4 text-sm font-medium text-ink dark:text-white">{t("an.adminOnly")}</p>
      </div>
    );
  }

  const chat = stats?.usage?.chat;
  const upload = stats?.usage?.upload;
  const totalTokens = stats ? Object.values(stats.usage).reduce((sum, item) => sum + (item.totalTokens ?? 0), 0) : 0;

  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink dark:text-white">{t("an.title")}</h1>
        <p className="mt-1.5 text-sm text-ink/55 dark:text-white/55">{t("an.subtitle")}</p>
      </header>

      {error ? (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      {loading || !stats ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-28 rounded-2xl border border-line bg-white dark:border-white/10 dark:bg-[#0c0c0e]">
              <div className="skeleton m-4 h-full rounded-lg" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {stats.revenue ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-ink/70 dark:text-white/70">{t("an.revenue")}</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <MoneyCard
                  icon={Wallet}
                  label={t("an.revenueTotal")}
                  value={`${nf.format(stats.revenue.total)} ${stats.revenue.currency}`}
                  note={t("an.revenueNote")}
                />
                <MoneyCard
                  icon={TrendingUp}
                  label={t("an.revenueMonth")}
                  value={`${nf.format(stats.revenue.thisMonth)} ${stats.revenue.currency}`}
                />
                <StatCard icon={Inbox} label={t("an.pendingRequests")} value={stats.revenue.pendingRequests} />
              </div>
            </section>
          ) : null}

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-ink/70 dark:text-white/70">{t("an.library")}</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard icon={BookOpenText} label={t("an.books")} value={stats.totalBooks} />
              <StatCard icon={FileText} label={t("an.pages")} value={stats.totalPages} />
              <StatCard icon={Layers} label={t("an.chunks")} value={stats.totalChunks} />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-ink/70 dark:text-white/70">{t("an.activity")}</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <ActivityCard
                icon={MessageSquareText}
                label={t("an.chatRequests")}
                total={chat?.total ?? 0}
                successful={chat?.successful ?? 0}
                failed={chat?.failed ?? 0}
                successLabel={t("an.successful")}
                failLabel={t("an.failed")}
              />
              <ActivityCard
                icon={UploadCloud}
                label={t("an.uploads")}
                total={upload?.total ?? 0}
                successful={upload?.successful ?? 0}
                failed={upload?.failed ?? 0}
                successLabel={t("an.successful")}
                failLabel={t("an.failed")}
              />
              <StatCard icon={BarChart3} label={t("an.totalTokens")} value={totalTokens} note={t("an.tokensNote")} />
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-ink/70 dark:text-white/70">{t("an.unanswered")}</h2>
              <p className="mt-0.5 text-xs text-ink/45 dark:text-white/45">{t("an.unansweredNote")}</p>
            </div>
            <div className="rounded-2xl border border-line bg-white dark:border-white/10 dark:bg-[#0c0c0e]">
              {stats.unansweredQuestions && stats.unansweredQuestions.length ? (
                <ul className="divide-y divide-line dark:divide-white/10">
                  {stats.unansweredQuestions.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 px-4 py-3">
                      <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" />
                      <span dir="auto" className="min-w-0 flex-1 text-sm text-ink/80 dark:text-white/80">
                        {item.question}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-8 text-center text-sm text-ink/45 dark:text-white/45">{t("an.noUnanswered")}</p>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-ink/70 dark:text-white/70">{t("an.feedback")}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <ActivityCard
                icon={ThumbsUp}
                label={t("an.helpfulVotes")}
                total={stats.feedback?.up ?? 0}
                successful={stats.feedback?.up ?? 0}
                failed={stats.feedback?.down ?? 0}
                successLabel={t("an.helpfulVotes")}
                failLabel={t("an.notHelpfulVotes")}
              />
              <div className="rounded-2xl border border-line bg-white p-5 dark:border-white/10 dark:bg-[#0c0c0e]">
                <p className="text-sm font-semibold text-ink dark:text-white">{t("an.reports")}</p>
                {stats.reports && stats.reports.length ? (
                  <ul className="mt-3 space-y-2">
                    {stats.reports.map((report, index) => (
                      <li key={index} dir="auto" className="border-s-2 border-red-300 ps-2.5 text-xs text-ink/70 dark:border-red-500/40 dark:text-white/70">
                        {report.note}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-ink/45 dark:text-white/45">{t("an.noReports")}</p>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  note
}: {
  icon: typeof BookOpenText;
  label: string;
  value: number;
  note?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 dark:border-white/10 dark:bg-[#0c0c0e]">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-moss/10 text-moss dark:bg-sea/15 dark:text-sea">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <p className="mt-3 text-2xl font-semibold tabular-nums text-ink dark:text-white">{nf.format(value)}</p>
      <p className="mt-0.5 text-sm text-ink/55 dark:text-white/55">{label}</p>
      {note ? <p className="mt-2 text-xs leading-5 text-ink/40 dark:text-white/40">{note}</p> : null}
    </div>
  );
}

function MoneyCard({
  icon: Icon,
  label,
  value,
  note
}: {
  icon: typeof BookOpenText;
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 dark:border-white/10 dark:bg-[#0c0c0e]">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-copper/10 text-copper">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <p className="mt-3 text-2xl font-semibold tabular-nums text-ink dark:text-white">{value}</p>
      <p className="mt-0.5 text-sm text-ink/55 dark:text-white/55">{label}</p>
      {note ? <p className="mt-2 text-xs leading-5 text-ink/40 dark:text-white/40">{note}</p> : null}
    </div>
  );
}

function ActivityCard({
  icon: Icon,
  label,
  total,
  successful,
  failed,
  successLabel,
  failLabel
}: {
  icon: typeof BookOpenText;
  label: string;
  total: number;
  successful: number;
  failed: number;
  successLabel: string;
  failLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 dark:border-white/10 dark:bg-[#0c0c0e]">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-moss/10 text-moss dark:bg-sea/15 dark:text-sea">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <p className="mt-3 text-2xl font-semibold tabular-nums text-ink dark:text-white">{nf.format(total)}</p>
      <p className="mt-0.5 text-sm text-ink/55 dark:text-white/55">{label}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line/70 pt-3 text-xs dark:border-white/10">
        <span className="inline-flex items-center gap-1 text-moss dark:text-sea">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {nf.format(successful)} {successLabel}
        </span>
        <span className="inline-flex items-center gap-1 text-ink/45 dark:text-white/45">
          <XCircle className="h-3.5 w-3.5" />
          {nf.format(failed)} {failLabel}
        </span>
      </div>
    </div>
  );
}
