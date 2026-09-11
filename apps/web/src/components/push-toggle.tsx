"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useT } from "@/lib/i18n";
import { currentPushSubscription, disablePush, enablePush, isPushSupported } from "@/lib/push";

type State = "loading" | "off" | "on" | "denied" | "unavailable";

/**
 * Per-device switch for browser push. Renders nothing where push cannot work —
 * an unsupported browser, or an origin without HTTPS — rather than showing a
 * control that would only ever fail.
 */
export function PushToggle() {
  const { token } = useAuth();
  const t = useT();
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!isPushSupported()) {
      setState("unavailable");
      return () => { cancelled = true; };
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return () => { cancelled = true; };
    }
    currentPushSubscription()
      .then((subscription) => { if (!cancelled) setState(subscription ? "on" : "off"); })
      .catch(() => { if (!cancelled) setState("off"); });
    return () => { cancelled = true; };
  }, []);

  if (state === "loading" || state === "unavailable") return null;

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      if (state === "on") {
        await disablePush(token);
        setState("off");
        return;
      }
      const result = await enablePush(token);
      setState(result === "enabled" ? "on" : result === "denied" ? "denied" : "unavailable");
    } finally {
      setBusy(false);
    }
  }

  if (state === "denied") {
    return <p className="text-xs text-ink/60 dark:text-white/60">{t("notifications.push.denied")}</p>;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-lg border border-ink/15 px-3 py-2 text-sm text-ink/80 transition hover:bg-ink/5 disabled:opacity-60 dark:border-white/15 dark:text-white/80 dark:hover:bg-white/5"
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : state === "on" ? (
        <BellOff className="h-4 w-4" />
      ) : (
        <Bell className="h-4 w-4" />
      )}
      {state === "on" ? t("notifications.push.disable") : t("notifications.push.enable")}
    </button>
  );
}
