"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { EyeOff } from "lucide-react";
import { useT } from "@/lib/i18n";

/**
 * Hides the book whenever the page is not the reader's active focus, and on the
 * keystrokes that usually precede a capture.
 *
 * What this is NOT: a screenshot block. No browser exposes one — the operating
 * system takes the picture and never tells the page. The book also renders
 * inside a cross-origin Heyzine iframe, so nothing here can reach the page
 * pixels themselves; the cover is drawn over the iframe instead.
 *
 * What it does achieve: a capture tool that steals focus, an alt-tab, a
 * minimised window, or a screen recorder started after the fact all land on the
 * cover rather than the book, and the print path is closed off. That is
 * friction and nothing more — a phone camera still works.
 */
export function ReaderGuard({ children }: { children: ReactNode }) {
  const t = useT();
  const [hidden, setHidden] = useState(false);

  const hide = useCallback(() => setHidden(true), []);

  // Marks the document while a book is open so the print stylesheet in
  // globals.css can withhold it. Cleared on unmount so the rest of the app
  // still prints normally.
  useEffect(() => {
    document.body.dataset.reading = "true";
    document.body.dataset.printNotice = t("guard.hiddenHint");
    return () => {
      delete document.body.dataset.reading;
      delete document.body.dataset.printNotice;
    };
  }, [t]);

  useEffect(() => {
    function onVisibility() {
      // Only ever hides. Coming back is a deliberate click, so a capture tool
      // that flicks focus away and back cannot silently uncover the book.
      if (document.visibilityState !== "visible") hide();
    }

    function onKeyDown(event: KeyboardEvent) {
      const key = event.key;
      // PrintScreen on Windows/Linux. The event arrives after the capture, so
      // this defeats the second attempt, not the first.
      if (key === "PrintScreen" || key === "F13") {
        hide();
        return;
      }
      // macOS: Cmd+Shift+3/4/5. Windows: Win+Shift+S (the meta key is reported
      // on keydown even though the shortcut belongs to the OS).
      if (event.shiftKey && (event.metaKey || event.ctrlKey) && ["3", "4", "5", "S", "s"].includes(key)) {
        hide();
        return;
      }
      // Print, and the save-page dialog that renders the same content.
      if ((event.metaKey || event.ctrlKey) && ["p", "P", "s", "S"].includes(key)) {
        event.preventDefault();
        hide();
      }
    }

    function block(event: Event) {
      event.preventDefault();
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", hide);
    window.addEventListener("beforeprint", hide);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("contextmenu", block);
    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    document.addEventListener("dragstart", block);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", hide);
      window.removeEventListener("beforeprint", hide);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      document.removeEventListener("dragstart", block);
    };
  }, [hide]);

  return (
    <div className="relative h-full min-h-0 select-none">
      {children}
      {hidden ? (
        <button
          type="button"
          onClick={() => setHidden(false)}
          data-testid="reader-guard-cover"
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-paper/95 p-6 text-center backdrop-blur-xl dark:bg-[#08080a]/95"
        >
          <EyeOff className="h-7 w-7 text-ink/60 dark:text-white/60" />
          <span className="text-sm font-semibold text-ink dark:text-white">{t("guard.hidden")}</span>
          <span className="max-w-xs text-xs text-ink/70 dark:text-white/70">{t("guard.hiddenHint")}</span>
          <span className="mt-1 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink dark:border-white/10 dark:text-white">
            {t("guard.resume")}
          </span>
        </button>
      ) : null}
    </div>
  );
}
