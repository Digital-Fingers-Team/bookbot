"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";

export function ThemeToggle() {
  const t = useT();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("bookbot-theme", next ? "dark" : "light");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-ink/[0.03] text-ink/65 transition hover:border-moss/40 hover:bg-moss/[0.06] hover:text-moss dark:border-white/10 dark:bg-white/5 dark:text-white/65 dark:hover:border-sea/40 dark:hover:bg-sea/10 dark:hover:text-sea"
      aria-label={t("common.toggleTheme")}
      title={t("common.toggleTheme")}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
