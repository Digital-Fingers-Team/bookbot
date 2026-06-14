"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenText, Home, Library, MessageSquareText, Search, UploadCloud } from "lucide-react";
import { clsx } from "clsx";
import { ThemeToggle } from "./theme-toggle";

const navItems = [
  { href: "/", label: "اسأل الكتب", icon: MessageSquareText },
  { href: "/upload", label: "رفع كتاب", icon: UploadCloud },
  { href: "/library", label: "مكتبتي", icon: Library }
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <header className="bg-white shadow-sm dark:bg-ink">
      <div className="border-b border-line bg-[#eeeeec] text-sm text-ink/70 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
        <div className="mx-auto flex w-full max-w-7xl justify-end gap-8 px-4 py-2 sm:px-6 lg:px-8">
          <span>تسجيل</span>
          <span>دخول</span>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-7 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-4 lg:order-2">
          <span className="relative inline-flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-[6px] border-moss/20 bg-white text-moss shadow-sm">
            <BookOpenText className="h-9 w-9" />
            <span className="absolute inset-2 rounded-full border border-moss/45" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-2xl font-semibold text-moss dark:text-white">BookBot</span>
            <span className="mt-1 block text-sm text-ink/60 dark:text-white/60">مكتبة معرفية ذكية للكتب المرفوعة</span>
          </span>
        </Link>

        <div className="flex h-12 w-full max-w-md overflow-hidden border border-line bg-[#dddddd] lg:order-1">
          <button
            type="button"
            className="inline-flex w-14 items-center justify-center bg-copper text-white"
            aria-label="بحث"
            title="بحث"
          >
            <Search className="h-6 w-6" />
          </button>
          <div className="flex-1" />
        </div>

        <div className="lg:order-3">
          <ThemeToggle />
        </div>
      </div>

      <nav className="bg-moss text-white">
        <div className="mx-auto flex w-full max-w-7xl items-stretch justify-start px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className={clsx(
              "inline-flex h-14 w-16 items-center justify-center transition",
              pathname === "/" ? "bg-copper text-white" : "hover:bg-white/10"
            )}
            aria-label="الرئيسية"
            title="الرئيسية"
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
                  active
                    ? "bg-white/12 text-white"
                    : "text-white/90 hover:bg-white/10 hover:text-white"
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
