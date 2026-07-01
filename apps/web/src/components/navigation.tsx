"use client";

import { type ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookMarked,
  Inbox,
  Library,
  LogIn,
  MessageSquareText,
  ShieldCheck,
  UploadCloud,
  UserRound,
  UsersRound,
  UserPlus,
  BookOpenText
} from "lucide-react";
import { clsx } from "clsx";
import { ThemeToggle } from "./theme-toggle";
import { LanguageToggle } from "./language-toggle";
import { SiteFooter } from "./site-footer";
import { useAuth } from "./auth-provider";
import { unseenRequestCount } from "@/lib/api";
import { useT, type StringKey } from "@/lib/i18n";

type NavItem = { href: string; key: StringKey; icon: typeof Library };

const baseNavItems: NavItem[] = [
  { href: "/", key: "nav.ask", icon: MessageSquareText },
  { href: "/my-books", key: "nav.myBooks", icon: BookMarked },
  { href: "/library", key: "nav.library", icon: Library }
];

const adminNavItems: NavItem[] = [
  { href: "/upload", key: "nav.upload", icon: UploadCloud },
  { href: "/requests", key: "nav.requests", icon: Inbox },
  { href: "/users", key: "nav.users", icon: UsersRound },
  { href: "/analytics", key: "nav.analytics", icon: BarChart3 }
];

// Highlight the nav item for the current route, including nested routes like
// /read/[id] (which belongs under Library). "/" must match exactly so it does
// not light up on every page.
function isActive(href: string, pathname: string | null) {
  if (!pathname) return false;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return (
      <>
        <SkipLink />
        <PublicHeader loading={loading} />
        <main id="main-content" className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          {children}
          <SiteFooter />
        </main>
      </>
    );
  }

  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}

function SkipLink() {
  const t = useT();
  return (
    <a href="#main-content" className="skip-link">
      {t("nav.skipToContent")}
    </a>
  );
}

function PublicHeader({ loading = false }: { loading?: boolean }) {
  const pathname = usePathname();
  const t = useT();
  const showPrimaryNav = pathname ? !["/", "/login", "/register"].includes(pathname) : true;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/80 backdrop-blur-md dark:border-white/10 dark:bg-[#0a0a0b]/80">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-3.5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <Brand />
          <div className="lg:hidden">
            <LanguageToggle />
          </div>
        </div>

        <nav className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:flex-1 lg:justify-end">
          {showPrimaryNav ? (
            <div className="flex items-center gap-1 rounded-xl border border-line bg-paper p-1 dark:border-white/10 dark:bg-white/5">
              {baseNavItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href, pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      "inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition sm:flex-none",
                      active
                        ? "bg-white text-ink shadow-sm dark:bg-white/10 dark:text-white"
                        : "text-ink/70 hover:text-ink dark:text-white/70 dark:hover:text-white"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{t(item.key)}</span>
                  </Link>
                );
              })}
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            {loading ? (
              <span className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-line px-4 text-sm font-medium text-ink/70 dark:border-white/10 dark:text-white/70 sm:flex-none">
                {t("nav.loadingAccount")}
              </span>
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-medium text-ink transition hover:bg-ink/[0.03] dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 sm:flex-none"
                >
                  <LogIn className="h-4 w-4" />
                  {t("nav.signin")}
                </Link>
                <Link
                  href="/register"
                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-moss px-4 text-sm font-medium text-white transition hover:bg-moss/90 sm:flex-none"
                >
                  <UserPlus className="h-4 w-4" />
                  {t("nav.create")}
                </Link>
              </>
            )}
            <div className="hidden items-center gap-2 lg:flex">
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
}

function AuthenticatedShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, isAdmin, token } = useAuth();
  const t = useT();
  // Keep user-facing items together and group admin tools under their own
  // labeled section instead of interleaving the two scopes.
  const sections: { label?: string; items: NavItem[] }[] = isAdmin
    ? [{ items: baseNavItems }, { label: t("nav.adminSection"), items: adminNavItems }]
    : [{ items: baseNavItems }];
  const navItems = sections.flatMap((section) => section.items);

  // Non-admins: show a dot on "Library" when a paid request was decided.
  const [unseen, setUnseen] = useState(0);
  useEffect(() => {
    if (isAdmin || !token) return;
    let active = true;
    const poll = () =>
      unseenRequestCount(token)
        .then((r) => {
          if (active) setUnseen(r.count);
        })
        .catch(() => undefined);
    poll();
    const interval = setInterval(poll, 60000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [isAdmin, token, pathname]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <SkipLink />
      <aside className="hidden border-e border-line bg-white dark:border-white/10 dark:bg-[#0a0a0b] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="px-5 py-5">
          <Brand stacked />
        </div>

        <nav className="flex-1 space-y-0.5 px-3">
          {sections.map((section, index) => (
            <div key={section.label ?? "primary"} className={clsx(index > 0 && "mt-4")}>
              {section.label ? (
                <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wide text-ink/70 dark:text-white/70">
                  {section.label}
                </p>
              ) : null}
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href, pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={clsx(
                      "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition",
                      active
                        ? "bg-moss/[0.08] text-moss dark:bg-sea/15 dark:text-sea"
                        : "text-ink/70 hover:bg-ink/[0.04] hover:text-ink dark:text-white/70 dark:hover:bg-white/5 dark:hover:text-white"
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                    {t(item.key)}
                    {item.href === "/library" && unseen > 0 ? (
                      <span className="ms-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold text-white">
                        {unseen}
                        <span className="sr-only"> {t("nav.newDecisions")}</span>
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <Link
          href="/settings"
          className="mx-3 mb-2 flex items-center gap-3 rounded-lg px-2.5 py-2.5 transition hover:bg-ink/[0.04] dark:hover:bg-white/5"
        >
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-moss text-sm font-semibold uppercase text-white">
            {user?.name?.trim()?.charAt(0) || "?"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink dark:text-white">{user?.name}</p>
            <p className="truncate text-xs text-ink/70 dark:text-white/70">{user?.email}</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-ink/70 dark:text-white/70">
            {isAdmin ? <ShieldCheck className="h-3.5 w-3.5" /> : <BookOpenText className="h-3.5 w-3.5" />}
            {isAdmin ? t("role.admin") : t("role.user")}
          </span>
        </Link>

        <div className="flex items-center justify-between border-t border-line px-5 py-3.5 dark:border-white/10">
          <span className="text-xs font-medium text-ink/70 dark:text-white/70">{t("nav.appearance")}</span>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-line bg-white/80 px-4 py-3 backdrop-blur-md dark:border-white/10 dark:bg-[#0a0a0b]/80 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <Brand compact />
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
              <Link
                href="/settings"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-white text-ink/70 transition hover:text-ink dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:text-white"
                aria-label={t("nav.profileSettings")}
                title={t("nav.profileSettings")}
              >
                <UserRound className="h-4 w-4" />
              </Link>
            </div>
          </div>
          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {sections.map((section, index) => (
              <div key={section.label ?? "primary"} className="flex shrink-0 items-center gap-2">
                {index > 0 ? (
                  <span className="mx-1 h-6 w-px shrink-0 bg-line dark:bg-white/10" aria-hidden />
                ) : null}
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href, pathname);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={clsx(
                        "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition",
                        active
                          ? "bg-moss/[0.08] text-moss dark:bg-sea/15 dark:text-sea"
                          : "border border-line bg-white text-ink/70 hover:text-ink dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:text-white"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {t(item.key)}
                      {item.href === "/library" && unseen > 0 ? (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold text-white">
                          {unseen}
                          <span className="sr-only"> {t("nav.newDecisions")}</span>
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </header>

        <main id="main-content" className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
          <SiteFooter />
        </main>
      </div>
    </div>
  );
}

// Logo + organization wordmark. Replace /public/logo.jpeg with the official logo.
function Brand({ compact = false, stacked = false }: { compact?: boolean; stacked?: boolean }) {
  const t = useT();
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.jpeg"
        alt={t("brand.org")}
        className={clsx("shrink-0 rounded-xl", compact ? "h-9 w-9" : "h-10 w-10")}
      />
      {compact ? (
        <span className="truncate text-sm font-bold leading-tight text-ink dark:text-white">{t("brand.orgShort")}</span>
      ) : (
        <span className="min-w-0">
          <span
            className={clsx(
              "block font-bold leading-tight text-ink dark:text-white",
              stacked ? "text-[0.95rem]" : "truncate text-base"
            )}
          >
            {t("brand.orgShort")}
          </span>
          <span className="block truncate text-xs text-ink/70 dark:text-white/70">
            {stacked ? t("brand.workspace") : t("brand.tagline")}
          </span>
        </span>
      )}
    </Link>
  );
}

export function Navigation() {
  return <PublicHeader />;
}
