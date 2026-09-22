"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useT } from "@/lib/i18n";

/**
 * Shown over the reader until the reader has accepted the agreement, once per
 * account. Acceptance is recorded server-side, so clearing browser storage does
 * not bring the modal back, and the timestamp is the server's.
 *
 * Signed-out visitors never see it: there is no account to record it against,
 * and the access middleware already decides what they may open.
 */
export function ReadingTermsGate() {
  const { user, acceptTerms } = useAuth();
  const router = useRouter();
  const t = useT();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!user || user.readingTermsAccepted) {
    return null;
  }

  async function agree() {
    setSaving(true);
    setError("");
    try {
      await acceptTerms();
    } catch {
      setError(t("terms.failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("terms.title")}
      className="absolute inset-0 z-30 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm dark:bg-black/60"
    >
      <div className="max-w-md rounded-2xl border border-line bg-white p-6 shadow-xl dark:border-white/10 dark:bg-[#0c0c0e]">
        <div className="mb-3 flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-moss dark:text-sea" />
          <h2 className="text-base font-semibold text-ink dark:text-white">{t("terms.title")}</h2>
        </div>
        <p dir="auto" className="text-sm leading-relaxed text-ink/80 dark:text-white/80">
          {t("terms.body")}
        </p>
        {error ? <p className="mt-3 text-xs text-red-600 dark:text-red-300">{error}</p> : null}
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => router.push("/my-books")}
            className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink/70 transition hover:text-ink dark:border-white/10 dark:text-white/70 dark:hover:text-white"
          >
            {t("terms.decline")}
          </button>
          <button
            type="button"
            onClick={agree}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-moss px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60 dark:bg-sea"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("terms.agree")}
          </button>
        </div>
      </div>
    </div>
  );
}
