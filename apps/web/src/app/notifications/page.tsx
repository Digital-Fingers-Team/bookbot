"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, Clock, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AdminNotification
} from "@/lib/api";
import { useLang } from "@/lib/i18n";

export default function NotificationsPage() {
  const router = useRouter();
  const { token, isAdmin, loading: authLoading } = useAuth();
  const { t, lang } = useLang();
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const result = await listNotifications(token);
      setNotifications(result.notifications);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) {
      router.replace("/");
      return;
    }
    refresh();
  }, [authLoading, isAdmin, refresh, router]);

  async function markAllRead() {
    if (!token || busy) return;
    setBusy(true);
    try {
      await markAllNotificationsRead(token);
      setNotifications((previous) => previous.map((notification) => ({ ...notification, readAt: new Date().toISOString() })));
    } finally {
      setBusy(false);
    }
  }

  async function openNotification(notification: AdminNotification) {
    if (token && !notification.readAt) {
      await markNotificationRead(notification.id, token).catch(() => undefined);
      setNotifications((previous) =>
        previous.map((item) => (item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item))
      );
    }
  }

  if (authLoading || !isAdmin) {
    return <div className="flex min-h-[50vh] items-center justify-center text-ink/70 dark:text-white/70"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const unread = notifications.filter((notification) => !notification.readAt).length;

  return (
    <div className="mx-auto max-w-3xl py-2">
      <header className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-moss dark:text-sea" />
          <div>
            <h1 className="text-lg font-bold text-ink dark:text-white">{t("notifications.title")}</h1>
            <p className="mt-0.5 text-sm text-ink/70 dark:text-white/70">{t("notifications.subtitle")}</p>
          </div>
        </div>
        {unread > 0 ? (
          <button
            type="button"
            onClick={markAllRead}
            disabled={busy}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink/70 transition hover:text-moss disabled:opacity-50 dark:border-white/10 dark:text-white/70"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
            {t("notifications.markAll")}
          </button>
        ) : null}
      </header>

      {loading ? (
        <div className="flex justify-center py-12 text-ink/70"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : notifications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line px-5 py-12 text-center text-sm text-ink/65 dark:border-white/10 dark:text-white/65">
          <Bell className="mx-auto h-8 w-8 opacity-40" />
          <p className="mt-3">{t("notifications.empty")}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {notifications.map((notification) => {
            const content = (
              <div className={`rounded-xl border p-4 transition ${notification.readAt ? "border-line bg-white dark:border-white/10 dark:bg-[#0c0c0e]" : "border-moss/30 bg-moss/[0.06] dark:border-sea/30 dark:bg-sea/[0.08]"}`}>
                <div className="flex items-start gap-3">
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${notification.readAt ? "bg-ink/20 dark:bg-white/20" : "bg-alert"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink dark:text-white">{notification.title}</p>
                    <p dir="auto" className="mt-1 text-sm leading-6 text-ink/75 dark:text-white/75">{notification.message}</p>
                    <p className="mt-2 inline-flex items-center gap-1 text-xs text-ink/50 dark:text-white/50">
                      <Clock className="h-3.5 w-3.5" />
                      {formatNotificationDate(notification.createdAt, lang)}
                    </p>
                  </div>
                </div>
              </div>
            );

            return <li key={notification.id}>{notification.href ? <Link href={notification.href} onClick={() => void openNotification(notification)}>{content}</Link> : <button type="button" className="block w-full text-start" onClick={() => void openNotification(notification)}>{content}</button>}</li>;
          })}
        </ul>
      )}
    </div>
  );
}

function formatNotificationDate(value: string, lang: "ar" | "en") {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
