"use client";

import { Languages } from "lucide-react";
import { useLang } from "@/lib/i18n";

export function LanguageToggle() {
  const { lang, setLang } = useLang();

  return (
    <button
      type="button"
      onClick={() => setLang(lang === "ar" ? "en" : "ar")}
      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-line bg-white px-3 text-sm font-semibold text-ink transition hover:border-moss hover:text-moss dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:border-sea dark:hover:text-sea"
      aria-label={lang === "ar" ? "Switch to English" : "التبديل إلى العربية"}
      title={lang === "ar" ? "English" : "العربية"}
    >
      <Languages className="h-4 w-4" />
      {lang === "ar" ? "EN" : "ع"}
    </button>
  );
}
