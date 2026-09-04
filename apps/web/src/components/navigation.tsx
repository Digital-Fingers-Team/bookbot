"use client";

import { type ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  BookMarked,
  GraduationCap,
  Inbox,
  Library,
  LogIn,
  Menu,
  MessageSquareText,
  Network,
  ShieldCheck,
  ThumbsDown,
  UploadCloud,
  UserRound,
  UsersRound,
  UserPlus,
  BookOpenText,
  X
} from "lucide-react";
import { clsx } from "clsx";
import { buttonClass } from "./ui/button";
import { ThemeToggle } from "./theme-toggle";
import { LanguageToggle } from "./language-toggle";
import { SiteFooter } from "./site-footer";
import { useAuth } from "./auth-provider";
import { unreadNotificationCount, unresolvedFeedbackCount, unseenRequestCount } from "@/lib/api";
import { useT, type StringKey } from "@/lib/i18n";

type NavItem = { href: string; key: StringKey; icon: typeof Library };

const baseNavItems: NavItem[] = [
  { href: "/", key: "nav.ask", icon: MessageSquareText },
  { href: "/my-books", key: "nav.myBooks", icon: BookMarked },
  { href: "/library", key: "nav.library", icon: Library }
];

const adminNavItems: NavItem[] = [
  { href: "/upload", key: "nav.upload", icon: UploadCloud },
  { href: "/notifications", key: "nav.notifications", icon: Bell },
  { href: "/requests", key: "nav.requests", icon: Inbox },
  { href: "/feedback", key: "nav.feedback", icon: ThumbsDown },
  { href: "/users", key: "nav.users", icon: UsersRound },
  { href: "/organizations", key: "nav.organizations", icon: GraduationCap },
  { href: "/analytics", key: "nav.analytics", icon: BarChart3 }
];

const orgAdminNavItems: NavItem[] = [
  { href: "/org/students", key: "nav.orgStudents", icon: GraduationCap },
  { href: "/org/network", key: "nav.orgNetwork", icon: Network }
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
                <Link href="/login" className={buttonClass("secondary", "flex-1 sm:flex-none")}>
                  <LogIn className="h-4 w-4" />
                  {t("nav.signin")}
                </Link>
                <Link href="/register" className={buttonClass("primary", "flex-1 sm:flex-none")}>
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
  const { user, isAdmin, isOrgAdmin, token } = useAuth();
  const t = useT();
  // Keep user-facing items together and group admin tools under their own
  // labeled section instead of interleaving the two scopes.
  const sections: { label?: string; items: NavItem[] }[] = isAdmin
    ? [{ items: baseNavItems }, { label: t("nav.adminSection"), items: adminNavItems }]
    : isOrgAdmin
      ? [{ items: baseNavItems }, { label: t("nav.orgAdminSection"), items: orgAdminNavItems }]
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

  const [unreadNotifications, setUnreadNotifications] = useState(0);
  useEffect(() => {
    if (!isAdmin || !token) return;
    let active = true;
    const poll = () =>
      unreadNotificationCount(token)
        .then((r) => {
          if (active) setUnreadNotifications(r.count);
        })
        .catch(() => undefined);
    poll();
    const interval = setInterval(poll, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [isAdmin, token, pathname]);

  // Admins: show a count on "Feedback" for disliked answers still needing review.
  const [unresolvedFeedback, setUnresolvedFeedback] = useState(0);
  useEffect(() => {
    if (!isAdmin || !token) return;
    let active = true;
    const poll = () =>
      unresolvedFeedbackCount(token)
        .then((r) => {
          if (active) setUnresolvedFeedback(r.count);
        })
        .catch(() => undefined);
    poll();
    const interval = setInterval(poll, 60000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [isAdmin, token, pathname]);

  // Mobile navigation lives in a slide-in drawer instead of a top row. Close it
  // whenever the route changes so tapping a link dismisses the overlay.
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const sidebar = (onNavigate?: () => void) => (
    <SidebarNav
      sections={sections}
      pathname={pathname}
      unseen={unseen}
      unresolvedFeedback={unresolvedFeedback}
      unreadNotifications={unreadNotifications}
      userName={user?.name}
      userEmail={user?.email}
      isAdmin={isAdmin}
      isOrgAdmin={isOrgAdmin}
      t={t}
      onNavigate={onNavigate}
    />
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <SkipLink />
      <aside className="hidden border-e border-line bg-white dark:border-white/10 dark:bg-[#0a0a0b] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        {sidebar()}
      </aside>

      {menuOpen ? (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={t("nav.menu")}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={() => setMenuOpen(false)} />
          <aside className="absolute inset-y-0 start-0 flex w-[280px] max-w-[85%] animate-slide-in-left flex-col border-e border-line bg-white shadow-soft dark:border-white/10 dark:bg-[#0a0a0b]">
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label={t("nav.closeMenu")}
              className="absolute end-3 top-4 inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink/70 transition hover:bg-ink/5 hover:text-ink dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
            {sidebar(() => setMenuOpen(false))}
          </aside>
        </div>
      ) : null}

      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-line bg-white/80 px-3 py-2.5 backdrop-blur-md dark:border-white/10 dark:bg-[#0a0a0b]/80 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label={t("nav.openMenu")}
                title={t("nav.menu")}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-white text-ink/70 transition hover:text-ink dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:text-white"
              >
                <Menu className="h-5 w-5" />
              </button>
              <Brand compact />
            </div>
            <div className="flex shrink-0 items-center gap-2">
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
        </header>

        <main id="main-content" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {children}
          <SiteFooter />
        </main>
      </div>
    </div>
  );
}

// Shared sidebar body used by both the fixed desktop rail and the mobile drawer.
// `onNavigate` (drawer only) closes the overlay when a link is tapped.
function SidebarNav({
  sections,
  pathname,
  unseen,
  unresolvedFeedback,
  unreadNotifications,
  userName,
  userEmail,
  isAdmin,
  isOrgAdmin,
  t,
  onNavigate
}: {
  sections: { label?: string; items: NavItem[] }[];
  pathname: string | null;
  unseen: number;
  unresolvedFeedback: number;
  unreadNotifications: number;
  userName?: string;
  userEmail?: string;
  isAdmin: boolean;
  isOrgAdmin: boolean;
  t: (key: StringKey) => string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="px-5 py-5">
        <Brand stacked />
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
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
                  onClick={onNavigate}
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
                    <span className="ms-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-alert px-1.5 text-[11px] font-semibold text-white">
                      {unseen}
                      <span className="sr-only"> {t("nav.newDecisions")}</span>
                    </span>
                  ) : null}
                  {item.href === "/feedback" && unresolvedFeedback > 0 ? (
                    <span className="ms-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-alert px-1.5 text-[11px] font-semibold text-white">
                      {unresolvedFeedback}
                      <span className="sr-only"> {t("nav.newDislikes")}</span>
                    </span>
                  ) : null}
                  {item.href === "/notifications" && unreadNotifications > 0 ? (
                    <span className="ms-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-alert px-1.5 text-[11px] font-semibold text-white">
                      {unreadNotifications}
                      <span className="sr-only"> {t("nav.newNotifications")}</span>
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
        onClick={onNavigate}
        className="mx-3 mb-2 flex items-center gap-3 rounded-lg px-2.5 py-2.5 transition hover:bg-ink/[0.04] dark:hover:bg-white/5"
      >
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-moss text-sm font-semibold uppercase text-white">
          {userName?.trim()?.charAt(0) || "?"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink dark:text-white">{userName}</p>
          <p className="truncate text-xs text-ink/70 dark:text-white/70">{userEmail}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-ink/70 dark:text-white/70">
          {isAdmin ? (
            <ShieldCheck className="h-3.5 w-3.5" />
          ) : isOrgAdmin ? (
            <GraduationCap className="h-3.5 w-3.5" />
          ) : (
            <BookOpenText className="h-3.5 w-3.5" />
          )}
          {isAdmin ? t("role.admin") : isOrgAdmin ? t("role.orgAdmin") : t("role.user")}
        </span>
      </Link>

      <div className="flex items-center justify-between border-t border-line px-5 py-3.5 dark:border-white/10">
        <span className="text-xs font-medium text-ink/70 dark:text-white/70">{t("nav.appearance")}</span>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>
    </>
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
