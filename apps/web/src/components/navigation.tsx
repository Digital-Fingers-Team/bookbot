"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenText, Home, Library, MessageSquareText, Search, UploadCloud } from "lucide-react";
import { clsx } from "clsx";
import { ThemeToggle } from "./theme-toggle";
import { useAuth } from "./auth-provider";

const baseNavItems = [
  { href: "/", label: "Ask Books", icon: MessageSquareText },
  { href: "/library", label: "Library", icon: Library }
];

const adminNavItems = [{ href: "/upload", label: "Upload", icon: UploadCloud }];

export function Navigation() {
  const pathname = usePathname();
  const { user, logout, loading, isAdmin } = useAuth();
  const navItems = isAdmin ? [...baseNavItems.slice(0, 1), ...adminNavItems, ...baseNavItems.slice(1)] : baseNavItems;

  return (
    <header className="bg-white shadow-sm dark:bg-ink">
      <div className="border-b border-line bg-[#eceae2] text-sm text-ink/70 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
        <div className="mx-auto flex w-full max-w-7xl justify-end gap-5 px-4 py-2 sm:px-6 lg:px-8">
          {loading ? (
            <span>Loading account...</span>
          ) : user ? (
            <>
              <span className="font-medium text-moss">{user.name}</span>
              <span className="rounded bg-moss/10 px-2 text-xs font-semibold uppercase text-moss">{user.role}</span>
              <button type="button" onClick={logout} className="transition hover:text-moss">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/register" className="transition hover:text-moss">
                Create account
              </Link>
              <Link href="/login" className="transition hover:text-moss">
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-7 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-4">
          <span className="relative inline-flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-[6px] border-moss/20 bg-white text-moss shadow-sm">
            <BookOpenText className="h-9 w-9" />
            <span className="absolute inset-2 rounded-full border border-moss/45" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-2xl font-semibold text-moss dark:text-white">BookBot</span>
            <span className="mt-1 block text-sm text-ink/60 dark:text-white/60">Book-only knowledge from uploaded PDFs</span>
          </span>
        </Link>

        <div className="flex h-12 w-full max-w-md overflow-hidden border border-line bg-[#dedbd0]">
          <button
            type="button"
            className="inline-flex w-14 items-center justify-center bg-copper text-white"
            aria-label="Search"
            title="Search"
          >
            <Search className="h-6 w-6" />
          </button>
          <div className="flex-1" />
        </div>

        <ThemeToggle />
      </div>

      <nav className="bg-moss text-white">
        <div className="mx-auto flex w-full max-w-7xl items-stretch justify-start px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className={clsx(
              "inline-flex h-14 w-16 items-center justify-center transition",
              pathname === "/" ? "bg-copper text-white" : "hover:bg-white/10"
            )}
            aria-label="Home"
            title="Home"
          >
            <Home className="h-6 w-6" />
          </Link>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.href !== "/" && pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "inline-flex h-14 items-center gap-2 px-5 text-sm font-semibold transition",
                  active ? "bg-white/12 text-white" : "text-white/90 hover:bg-white/10 hover:text-white"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
