"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenText, Library, MessageSquareText, UploadCloud } from "lucide-react";
import { clsx } from "clsx";
import { ThemeToggle } from "./theme-toggle";

const navItems = [
  { href: "/", label: "Chat", icon: MessageSquareText },
  { href: "/upload", label: "Upload", icon: UploadCloud },
  { href: "/library", label: "Library", icon: Library }
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <header className="border-b border-line/80 bg-paper/90 backdrop-blur dark:border-white/10 dark:bg-ink/90">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-moss text-white shadow-sm">
            <BookOpenText className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-ink dark:text-white">BookBotD</span>
            <span className="hidden text-xs text-ink/60 dark:text-white/55 sm:block">Strict book-only knowledge</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 rounded-md border border-line/80 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-white/8">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "inline-flex h-9 items-center gap-2 rounded px-3 text-sm font-medium transition",
                  active
                    ? "bg-ink text-white dark:bg-white dark:text-ink"
                    : "text-ink/65 hover:bg-paper hover:text-ink dark:text-white/65 dark:hover:bg-white/10 dark:hover:text-white"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <ThemeToggle />
      </div>
    </header>
  );
}
