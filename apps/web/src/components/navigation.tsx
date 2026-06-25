"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenText,
  Library,
  LogIn,
  MessageSquareText,
  ShieldCheck,
  UploadCloud,
  UserRound,
  UserPlus
} from "lucide-react";
import { clsx } from "clsx";
import { ThemeToggle } from "./theme-toggle";
import { useAuth } from "./auth-provider";

const baseNavItems = [
  { href: "/", label: "Ask Books", icon: MessageSquareText },
  { href: "/library", label: "Library", icon: Library }
];

const adminNavItems = [{ href: "/upload", label: "Upload", icon: UploadCloud }];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <>
        <PublicHeader loading />
        <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">{children}</main>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <PublicHeader />
        <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">{children}</main>
      </>
    );
  }

  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}

function PublicHeader({ loading = false }: { loading?: boolean }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/80 backdrop-blur-md dark:border-white/10 dark:bg-[#0a0a0b]/80">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-3.5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <BrandMark />
            <span className="min-w-0">
              <span className="block truncate text-lg font-semibold tracking-tight text-ink dark:text-white">BookBot</span>
              <span className="block truncate text-xs text-ink/45 dark:text-white/45">Cited answers from your PDFs</span>
            </span>
          </Link>
          <div className="lg:hidden">
            <ThemeToggle />
          </div>
        </div>

        <nav className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:flex-1 lg:justify-end">
          <div className="flex items-center gap-1 rounded-xl border border-line bg-paper p-1 dark:border-white/10 dark:bg-white/5">
            {baseNavItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition sm:flex-none",
                    active
                      ? "bg-white text-ink shadow-sm dark:bg-white/10 dark:text-white"
                      : "text-ink/55 hover:text-ink dark:text-white/55 dark:hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {loading ? (
              <span className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-line px-4 text-sm font-medium text-ink/50 dark:border-white/10 dark:text-white/50 sm:flex-none">
                Loading account…
              </span>
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-medium text-ink transition hover:bg-ink/[0.03] dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 sm:flex-none"
                >
                  <LogIn className="h-4 w-4" />
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-moss px-4 text-sm font-medium text-white transition hover:bg-moss/90 sm:flex-none"
                >
                  <UserPlus className="h-4 w-4" />
                  Create account
                </Link>
              </>
            )}
            <div className="hidden lg:block">
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
  const { user, isAdmin } = useAuth();
  const navItems = isAdmin ? [...baseNavItems.slice(0, 1), ...adminNavItems, ...baseNavItems.slice(1)] : baseNavItems;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="hidden border-r border-line bg-white dark:border-white/10 dark:bg-[#0a0a0b] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="px-5 py-5">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark />
            <span>
              <span className="block text-lg font-semibold tracking-tight text-ink dark:text-white">BookBot</span>
              <span className="block text-xs text-ink/45 dark:text-white/45">Knowledge workspace</span>
            </span>
          </Link>
        </div>

        <nav className="flex-1 space-y-0.5 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition",
                  active
                    ? "bg-moss/[0.08] text-moss dark:bg-sea/15 dark:text-sea"
                    : "text-ink/60 hover:bg-ink/[0.04] hover:text-ink dark:text-white/55 dark:hover:bg-white/5 dark:hover:text-white"
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/settings"
          className="mx-3 mb-2 flex items-center gap-3 rounded-lg px-2.5 py-2.5 transition hover:bg-ink/[0.04] dark:hover:bg-white/5"
        >
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-moss text-sm font-semibold uppercase text-white">
            {user?.name.slice(0, 1) ?? "B"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink dark:text-white">{user?.name}</p>
            <p className="truncate text-xs text-ink/45 dark:text-white/45">{user?.email}</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-ink/40 dark:text-white/40">
            {isAdmin ? <ShieldCheck className="h-3.5 w-3.5" /> : <BookOpenText className="h-3.5 w-3.5" />}
            {user?.role}
          </span>
        </Link>

        <div className="flex items-center justify-between border-t border-line px-5 py-3.5 dark:border-white/10">
          <span className="text-xs font-medium text-ink/45 dark:text-white/45">Appearance</span>
          <ThemeToggle />
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-line bg-white/80 px-4 py-3 backdrop-blur-md dark:border-white/10 dark:bg-[#0a0a0b]/80 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="flex min-w-0 items-center gap-2">
              <BrandMark compact />
              <span className="truncate text-base font-semibold tracking-tight text-ink dark:text-white">BookBot</span>
            </Link>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link
                href="/settings"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-white text-ink/70 transition hover:text-ink dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:text-white"
                aria-label="Profile settings"
                title="Profile settings"
              >
                <UserRound className="h-4 w-4" />
              </Link>
            </div>
          </div>
          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition",
                    active
                      ? "bg-moss/[0.08] text-moss dark:bg-sea/15 dark:text-sea"
                      : "border border-line bg-white text-ink/60 hover:text-ink dark:border-white/10 dark:bg-white/5 dark:text-white/60 dark:hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={clsx(
        "relative inline-flex shrink-0 items-center justify-center rounded-xl border border-line bg-white text-moss dark:border-white/10 dark:bg-white/5 dark:text-sea",
        compact ? "h-9 w-9" : "h-10 w-10"
      )}
    >
      <BookOpenText className={compact ? "h-[18px] w-[18px]" : "h-5 w-5"} />
    </span>
  );
}

export function Navigation() {
  return <PublicHeader />;
}
