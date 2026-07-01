"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { listAccessRequests, markRequestsSeen, type AccessRequest } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { useT } from "@/lib/i18n";

const nf = new Intl.NumberFormat("en");

/**
 * Shows the signed-in user their own access requests (pending + decided) so they
 * know a paid request is under review or was approved/rejected. Marks decided
 * requests as seen on mount to clear the navigation notification dot.
 */
export function MyRequestsPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const { token } = useAuth();
  const t = useT();
  const [requests, setRequests] = useState<AccessRequest[]>([]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    listAccessRequests(token)
      .then((result) => {
        if (active) setRequests(result.requests);
      })
      .catch(() => undefined);
    // Seeing this panel clears the "your request was decided" notification.
    markRequestsSeen(token).catch(() => undefined);
    return () => {
      active = false;
    };
  }, [token, refreshKey]);

  if (!requests.length) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-4 dark:border-white/10 dark:bg-[#0c0c0e]">
      <h2 className="mb-3 text-sm font-semibold text-ink/70 dark:text-white/70">{t("req.myRequests")}</h2>
      <ul className="space-y-2">
        {requests.map((r) => (
          <li
            key={r.id}
            className="flex items-start justify-between gap-3 rounded-lg border border-line/70 px-3 py-2 dark:border-white/10"
          >
            <div className="min-w-0">
              <p dir="auto" className="truncate text-sm font-medium text-ink dark:text-white">
                {r.targetType === "category" ? "📂 " : "📘 "}
                {r.targetLabel || r.targetValue}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink/70 dark:text-white/70">
                {r.amount > 0 ? (
                  <span className="font-semibold text-copper">
                    {nf.format(r.amount)} {r.currency}
                  </span>
                ) : null}
                {r.adminNote ? <span dir="auto">“{r.adminNote}”</span> : null}
              </div>
            </div>
            <StatusPill status={r.status} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatusPill({ status }: { status: AccessRequest["status"] }) {
  const t = useT();
  const map = {
    pending: { icon: Clock, cls: "text-amber-500", label: t("req.pending") },
    approved: { icon: CheckCircle2, cls: "text-moss dark:text-sea", label: t("req.approved") },
    rejected: { icon: XCircle, cls: "text-red-500", label: t("req.rejected") }
  } as const;
  const { icon: Icon, cls, label } = map[status];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 text-xs font-medium ${cls}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
