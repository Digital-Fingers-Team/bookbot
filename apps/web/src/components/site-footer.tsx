"use client";

import { useT } from "@/lib/i18n";

export function SiteFooter() {
  const t = useT();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-10 border-t border-line pt-6 dark:border-white/10">
      <div className="flex flex-col items-center justify-between gap-2 text-xs text-ink/65 dark:text-white/70 sm:flex-row">
        <span>
          © {year} {t("brand.org")} — {t("footer.rights")}
        </span>
        <span>{t("footer.poweredBy")}</span>
      </div>
    </footer>
  );
}
