"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenText,
  ChevronRight,
  Library,
  LogIn,
  LogOut,
  MessageSquareText,
  ShieldCheck,
  UploadCloud,
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
        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <PublicHeader />
        <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </>
    );
  }

  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}

function PublicHeader({ loading = false }: { loading?: boolean }) {
  const pathname = usePathname();

  return (
    <header className="border-b border-line bg-white/95 shadow-sm backdrop-blur dark:border-white/10 dark:bg-ink/95">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <BrandMark />
            <span className="min-w-0">
              <span className="block truncate text-xl font-bold text-moss dark:text-white">BookBot</span>
              <span className="mt-0.5 block text-xs font-medium text-ink/55 dark:text-white/55">
                Cited answers from uploaded PDFs
              </span>
            </span>
          </Link>
          <div className="lg:hidden">
            <ThemeToggle />
          </div>
        </div>

        <nav className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:flex-1 lg:justify-end">
          <div className="flex items-center gap-1 rounded-md border border-line bg-paper p-1 dark:border-white/10 dark:bg-white/5">
            {baseNavItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "inline-flex h-10 flex-1 items-center justify-center gap-2 rounded px-3 text-sm font-semibold transition sm:flex-none",
                    active
                      ? "bg-white text-moss shadow-sm dark:bg-white/10 dark:text-white"
                      : "text-ink/65 hover:bg-white hover:text-moss dark:text-white/65 dark:hover:bg-white/10 dark:hover:text-white"
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
              <span className="inline-flex h-11 flex-1 items-center justify-center rounded-md border border-line px-4 text-sm font-semibold text-ink/60 dark:border-white/10 dark:text-white/60 sm:flex-none">
                Loading account...
              </span>
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md border border-moss/25 bg-white px-4 text-sm font-semibold text-moss transition hover:border-moss hover:bg-moss/5 dark:border-sea/35 dark:bg-white/5 dark:text-sea dark:hover:bg-sea/10 sm:flex-none"
                >
                  <LogIn className="h-4 w-4" />
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-moss px-4 text-sm font-semibold text-white shadow-sm shadow-moss/20 transition hover:bg-[#064b26] sm:flex-none"
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
  const { user, logout, isAdmin } = useAuth();
  const navItems = isAdmin ? [...baseNavItems.slice(0, 1), ...adminNavItems, ...baseNavItems.slice(1)] : baseNavItems;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="hidden border-r border-line bg-white/95 shadow-sm dark:border-white/10 dark:bg-ink/95 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="border-b border-line px-5 py-5 dark:border-white/10">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark />
            <span>
              <span className="block text-xl font-bold text-moss dark:text-white">BookBot</span>
              <span className="text-xs font-medium text-ink/55 dark:text-white/55">Knowledge workspace</span>
            </span>
          </Link>
        </div>

        <div className="border-b border-line px-5 py-4 dark:border-white/10">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-moss text-sm font-bold uppercase text-white">
              {user?.name.slice(0, 1) ?? "B"}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink dark:text-white">{user?.name}</p>
              <p className="truncate text-xs text-ink/50 dark:text-white/50">{user?.email}</p>
            </div>
          </div>
          <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-moss/15 bg-moss/10 px-2.5 py-1 text-xs font-bold uppercase text-moss dark:border-sea/30 dark:bg-sea/10 dark:text-sea">
            {isAdmin ? <ShieldCheck className="h-3.5 w-3.5" /> : <BookOpenText className="h-3.5 w-3.5" />}
            {user?.role}
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex h-11 items-center justify-between rounded-md px-3 text-sm font-semibold transition",
                  active
                    ? "bg-moss text-white shadow-sm"
                    : "text-ink/70 hover:bg-paper hover:text-moss dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
                )}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  {item.label}
                </span>
                {active ? <ChevronRight className="h-4 w-4" /> : null}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-line p-4 dark:border-white/10">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-ink/45 dark:text-white/45">Appearance</span>
            <ThemeToggle />
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-line bg-white text-sm font-semibold text-ink transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-red-500/10 dark:hover:text-red-200"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-line bg-white/95 px-4 py-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-ink/95 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="flex min-w-0 items-center gap-2">
              <BrandMark compact />
              <span className="truncate text-base font-bold text-moss dark:text-white">BookBot</span>
            </Link>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button
                type="button"
                onClick={logout}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-line bg-white text-ink transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-white/10 dark:bg-white/5 dark:text-white"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
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
                    "inline-flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold transition",
                    active
                      ? "bg-moss text-white"
                      : "border border-line bg-white text-ink/70 hover:text-moss dark:border-white/10 dark:bg-white/5 dark:text-white/70"
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
        "relative inline-flex shrink-0 items-center justify-center rounded-md border border-moss/15 bg-moss/10 text-moss shadow-sm dark:border-sea/25 dark:bg-sea/10 dark:text-sea",
        compact ? "h-10 w-10" : "h-12 w-12"
      )}
    >
      <BookOpenText className={compact ? "h-5 w-5" : "h-6 w-6"} />
    </span>
  );
}

export function Navigation() {
  return <PublicHeader />;
}
