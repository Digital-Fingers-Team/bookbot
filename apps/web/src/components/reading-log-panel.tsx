"use client";

import { useEffect, useState } from "react";
import { Loader2, ScrollText } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { getReadingLog, type ReadingLogEntry } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";

/**
 * The reading audit trail, newest first.
 *
 * Read-only and deliberately plain: an admin comes here to answer "who had this
 * book open", so the rows are shown as they were recorded rather than rolled up
 * into a chart. Failure is silent — a missing log must not break the analytics
 * page around it.
 */
export function ReadingLogPanel() {
  const { token } = useAuth();
  const { lang } = useLang();
  const t = useT();
  const [entries, setEntries] = useState<ReadingLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getReadingLog(token, 25)
      .then((result) => {
        if (!cancelled) setEntries(result.events);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const formatter = new Intl.DateTimeFormat(lang === "ar" ? "ar" : "en", {
    dateStyle: "medium",
    timeStyle: "short"
  });

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <ScrollText className="h-4 w-4 text-ink/70 dark:text-white/70" />
        <h2 className="text-sm font-semibold text-ink/70 dark:text-white/70">{t("an.readingLog")}</h2>
      </div>
      <div className="rounded-2xl border border-line bg-white p-4 dark:border-white/10 dark:bg-[#0c0c0e]">
        <p className="mb-3 text-xs text-ink/60 dark:text-white/60">{t("an.readingLogNote")}</p>
        {loading ? (
          <div className="flex items-center justify-center py-6 text-ink/60 dark:text-white/60">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <p className="py-4 text-sm text-ink/60 dark:text-white/60">{t("an.readingLogEmpty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-start text-sm">
              <thead>
                <tr className="text-xs text-ink/60 dark:text-white/60">
                  <th className="px-2 py-2 text-start font-medium">{t("an.logReader")}</th>
                  <th className="px-2 py-2 text-start font-medium">{t("an.logBook")}</th>
                  <th className="px-2 py-2 text-start font-medium">{t("an.logWhen")}</th>
                  <th className="px-2 py-2 text-start font-medium">{t("an.logIp")}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr key={`${entry.userId}-${entry.createdAt}-${index}`} className="border-t border-line dark:border-white/10">
                    <td className="px-2 py-2">
                      <span className="block text-ink dark:text-white">{entry.userName || "—"}</span>
                      <span className="block text-xs text-ink/60 dark:text-white/60">{entry.userEmail}</span>
                    </td>
                    <td dir="auto" className="px-2 py-2 text-ink/80 dark:text-white/80">{entry.bookTitle || "—"}</td>
                    <td className="px-2 py-2 text-ink/70 dark:text-white/70">{formatter.format(new Date(entry.createdAt))}</td>
                    <td className="px-2 py-2 font-mono text-xs text-ink/60 dark:text-white/60">{entry.ip || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
