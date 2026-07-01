"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Inbox, Loader2, Receipt, XCircle } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  decideAccessRequest,
  fetchReceiptObjectUrl,
  listAccessRequests,
  type AccessRequest
} from "@/lib/api";
import { useT } from "@/lib/i18n";

type StatusFilter = "pending" | "approved" | "rejected";

export default function RequestsPage() {
  const router = useRouter();
  const { token, isAdmin, loading: authLoading } = useAuth();
  const t = useT();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [receipt, setReceipt] = useState<{ id: string; url: string } | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const result = await listAccessRequests(token, filter);
      setRequests(result.requests);
      setCursor(result.nextCursor);
    } catch {
      setRequests([]);
      setCursor(null);
    } finally {
      setLoading(false);
    }
  }, [token, filter]);

  const loadMore = useCallback(async () => {
    if (!token || !cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await listAccessRequests(token, filter, cursor);
      setRequests((prev) => [...prev, ...result.requests]);
      setCursor(result.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [token, filter, cursor, loadingMore]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) {
      router.replace("/");
      return;
    }
    refresh();
  }, [authLoading, isAdmin, refresh, router]);

  async function decide(request: AccessRequest, action: "approve" | "reject") {
    setBusyId(request.id);
    try {
      await decideAccessRequest(request.id, action, "", token);
      await refresh();
    } finally {
      setBusyId("");
    }
  }

  async function viewReceipt(id: string) {
    try {
      const url = await fetchReceiptObjectUrl(id, token);
      setReceipt({ id, url });
    } catch {
      // ignore
    }
  }

  function closeReceipt() {
    if (receipt) URL.revokeObjectURL(receipt.url);
    setReceipt(null);
  }

  if (authLoading || !isAdmin) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-ink/70 dark:text-white/70">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl py-2">
      <header className="mb-5 flex items-center gap-2">
        <Inbox className="h-5 w-5 text-moss dark:text-sea" />
        <h1 className="text-lg font-bold text-ink dark:text-white">{t("nav.requests")}</h1>
      </header>

      <div className="mb-4 flex gap-2">
        {(["pending", "approved", "rejected"] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter(status)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              filter === status
                ? "bg-moss text-white"
                : "border border-line text-ink/70 hover:text-moss dark:border-white/10 dark:text-white/70"
            }`}
          >
            {t(`req.${status}` as never)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-ink/70">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <p className="py-12 text-center text-sm text-ink/70 dark:text-white/70">{t("req.empty")}</p>
      ) : (
        <ul className="space-y-3">
          {requests.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-line bg-white p-4 dark:border-white/10 dark:bg-[#0c0c0e]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p dir="auto" className="text-sm font-semibold text-ink dark:text-white">
                    {r.targetType === "category" ? "📂 " : "📘 "}
                    {r.targetLabel || r.targetValue}
                  </p>
                  <p className="mt-0.5 text-xs text-ink/70 dark:text-white/70">
                    {r.user?.name} · {r.user?.email}
                  </p>
                  {r.amount > 0 ? (
                    <p className="mt-1 text-sm font-bold text-copper">
                      {new Intl.NumberFormat("en").format(r.amount)} {r.currency}
                    </p>
                  ) : null}
                  {r.note ? (
                    <p dir="auto" className="mt-1.5 text-xs text-ink/70 dark:text-white/70">
                      “{r.note}”
                    </p>
                  ) : null}
                </div>
                <StatusPill status={r.status} />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => viewReceipt(r.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink/70 transition hover:text-moss dark:border-white/10 dark:text-white/70"
                >
                  <Receipt className="h-3.5 w-3.5" />
                  {t("req.viewReceipt")}
                </button>
                {r.status === "pending" ? (
                  <>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => decide(r, "approve")}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-moss px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-moss/90 disabled:opacity-50"
                    >
                      {busyId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      {t("req.approve")}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => decide(r, "reject")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-500/10 disabled:opacity-50"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      {t("req.reject")}
                    </button>
                  </>
                ) : null}
              </div>
            </li>
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

      {receipt ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={closeReceipt}>
          <div className="max-h-[85vh] max-w-2xl overflow-auto rounded-xl bg-white p-2 dark:bg-[#0c0c0e]" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={receipt.url} alt="receipt" className="max-h-[80vh] w-auto rounded-lg" />
          </div>
        </div>
      ) : null}
    </div>
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
