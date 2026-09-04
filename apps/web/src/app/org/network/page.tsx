"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Network } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import {
  ApiClientError,
  getMyOrgCurrentIp,
  getMyOrgNetworkPolicy,
  getMyOrganization,
  testMyOrgNetworkPolicy,
  updateMyOrgNetworkPolicy,
  type MyOrganization,
  type NetworkPolicy
} from "@/lib/api";
import { useT } from "@/lib/i18n";

export default function OrgNetworkPage() {
  const router = useRouter();
  const { token, isOrgAdmin, loading: authLoading } = useAuth();
  const t = useT();
  const [org, setOrg] = useState<MyOrganization | null>(null);
  const [policy, setPolicy] = useState<NetworkPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [currentIp, setCurrentIp] = useState("");
  const [status, setStatus] = useState("");

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [organization, networkPolicy] = await Promise.all([getMyOrganization(token), getMyOrgNetworkPolicy(token)]);
      setOrg(organization);
      setPolicy(networkPolicy);
      setCurrentIp(networkPolicy.lastObservedIp ?? "");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (authLoading) return;
    if (!isOrgAdmin) {
      router.replace("/");
      return;
    }
    void refresh();
  }, [authLoading, isOrgAdmin, router, refresh]);

  async function save(next: Partial<NetworkPolicy>) {
    if (!policy) return;
    setBusy(true);
    setStatus("");
    try {
      const result = await updateMyOrgNetworkPolicy(
        {
          networkRestrictionEnabled: next.networkRestrictionEnabled ?? policy.networkRestrictionEnabled,
          allowedIpCidrs: next.allowedIpCidrs ?? policy.allowedIpCidrs,
          downloadableBookIds: next.downloadableBookIds ?? policy.downloadableBookIds
        },
        token
      );
      setPolicy(result.networkPolicy);
      setStatus(t("orgNet.saved"));
    } catch (error) {
      setStatus(error instanceof ApiClientError ? error.message : t("orgNet.saveError"));
    } finally {
      setBusy(false);
    }
  }

  async function addNetwork() {
    const trimmed = input.trim();
    if (!policy || !trimmed || policy.allowedIpCidrs.includes(trimmed)) return;
    setInput("");
    await save({ allowedIpCidrs: [...policy.allowedIpCidrs, trimmed] });
  }

  async function removeNetwork(value: string) {
    if (!policy) return;
    await save({ allowedIpCidrs: policy.allowedIpCidrs.filter((cidr) => cidr !== value) });
  }

  async function toggleDownload(bookId: string) {
    if (!policy) return;
    const downloads = policy.downloadableBookIds.includes(bookId)
      ? policy.downloadableBookIds.filter((id) => id !== bookId)
      : [...policy.downloadableBookIds, bookId];
    await save({ downloadableBookIds: downloads });
  }

  async function detectIp() {
    setBusy(true);
    try {
      const result = await getMyOrgCurrentIp(token);
      setCurrentIp(result.ip);
      setPolicy(result.networkPolicy);
      setStatus(`${t("orgNet.currentIp")}: ${result.ip}`);
    } finally {
      setBusy(false);
    }
  }

  async function testIp() {
    setBusy(true);
    try {
      const result = await testMyOrgNetworkPolicy(currentIp || undefined, token);
      setStatus(result.allowed ? `${t("orgNet.allowed")} (${result.matchedCidrs.join(", ")})` : t("orgNet.notAllowed"));
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-ink/50 dark:text-white/50" />
      </div>
    );
  }
  if (!policy) return null;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Network className="h-5 w-5" />
          {t("orgNet.title")}
          {org ? <span className="text-sm font-normal text-ink/60 dark:text-white/60">— {org.name}</span> : null}
        </h1>
        <p className="text-sm text-ink/70 dark:text-white/70">{t("orgNet.subtitle")}</p>
      </header>

      <section className="space-y-4 rounded-xl border border-line p-4 dark:border-white/10">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">
            {policy.networkRestrictionEnabled ? t("orgNet.enabled") : t("orgNet.disabled")}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void save({ networkRestrictionEnabled: !policy.networkRestrictionEnabled })}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              policy.networkRestrictionEnabled
                ? "bg-moss text-white dark:bg-sea"
                : "bg-black/10 text-ink/70 dark:bg-white/10 dark:text-white/70"
            }`}
          >
            {policy.networkRestrictionEnabled ? "ON" : "OFF"}
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink/70 dark:text-white/70">
            {t("orgNet.networks")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {policy.allowedIpCidrs.map((cidr) => (
              <span
                key={cidr}
                className="inline-flex items-center gap-1 rounded-md bg-moss/10 px-2 py-1 text-xs text-moss dark:bg-sea/15 dark:text-sea"
              >
                {cidr}
                <button type="button" disabled={busy} onClick={() => void removeNetwork(cidr)} aria-label={`Remove ${cidr}`}>
                  ×
                </button>
              </span>
            ))}
            {!policy.allowedIpCidrs.length ? (
              <span className="text-xs text-ink/45 dark:text-white/45">{t("orgNet.none")}</span>
            ) : null}
          </div>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void addNetwork()}
              placeholder={t("orgNet.placeholder")}
              className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-transparent px-2 text-sm outline-none dark:border-white/10"
            />
            <button
              type="button"
              disabled={busy || !input.trim()}
              onClick={() => void addNetwork()}
              className="rounded-lg border border-line px-3 text-sm disabled:opacity-50 dark:border-white/10"
            >
              {t("orgNet.add")}
            </button>
          </div>
          <p className="text-xs text-ink/55 dark:text-white/55">{t("orgNet.hint")}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-ink/65 dark:text-white/65">
          <span>
            {t("orgNet.currentIp")}: {currentIp || "—"}
          </span>
          <button type="button" disabled={busy} onClick={() => void detectIp()} className="underline">
            {t("orgNet.detect")}
          </button>
          <button type="button" disabled={busy} onClick={() => void testIp()} className="underline">
            {t("orgNet.test")}
          </button>
          {status ? <span>{status}</span> : null}
        </div>

        {org?.allowedBooks.length ? (
          <div className="space-y-1 border-t border-line pt-3 dark:border-white/10">
            <p className="text-xs font-medium text-ink/70 dark:text-white/70">{t("orgNet.downloads")}</p>
            {org.allowedBooks.map((book) => (
              <label key={book.id} className="flex items-center gap-2 text-xs text-ink/70 dark:text-white/70">
                <input
                  type="checkbox"
                  checked={policy.downloadableBookIds.includes(book.id)}
                  disabled={busy}
                  onChange={() => void toggleDownload(book.id)}
                />
                <span className="truncate">{book.title}</span>
              </label>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
