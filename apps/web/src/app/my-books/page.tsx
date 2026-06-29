"use client";

import { type ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpenText, Clock, Heart, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { BookCover } from "@/components/book-cover";
import { getMyBooks, type MyBook } from "@/lib/api";
import { useT } from "@/lib/i18n";

const nf = new Intl.NumberFormat("en");

export default function MyBooksPage() {
  const router = useRouter();
  const { token, user, loading: authLoading } = useAuth();
  const t = useT();
  const [data, setData] = useState<{ favorites: MyBook[]; continueReading: MyBook[] }>({
    favorites: [],
    continueReading: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!user) {
      router.replace("/login?next=/my-books");
      return;
    }
    getMyBooks(token)
      .then(setData)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [authLoading, user, token, router]);

  if (authLoading || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-ink/40 dark:text-white/40">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const empty = !loading && !data.continueReading.length && !data.favorites.length;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink dark:text-white">{t("mb.title")}</h1>
        <p className="mt-1.5 text-sm text-ink/55 dark:text-white/55">{t("mb.subtitle")}</p>
      </header>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-32 rounded-2xl border border-line bg-white dark:border-white/10 dark:bg-[#0c0c0e]">
              <div className="skeleton m-4 h-full rounded-lg" />
            </div>
          ))}
        </div>
      ) : empty ? (
        <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-paper p-12 text-center dark:border-white/10 dark:bg-white/[0.02]">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-moss/10 text-moss dark:bg-sea/15 dark:text-sea">
            <BookOpenText className="h-6 w-6" />
          </span>
          <p className="mt-4 text-sm font-semibold text-ink dark:text-white">{t("mb.empty")}</p>
          <Link
            href="/library"
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-moss px-4 text-sm font-medium text-white transition hover:bg-moss/90"
          >
            {t("mb.browseLibrary")}
          </Link>
        </div>
      ) : (
        <>
          {data.continueReading.length ? (
            <Section icon={Clock} title={t("mb.continueReading")}>
              {data.continueReading.map((book) => (
                <MyBookCard key={book.id} book={book} showProgress />
              ))}
            </Section>
          ) : null}

          {data.favorites.length ? (
            <Section icon={Heart} title={t("mb.favorites")}>
              {data.favorites.map((book) => (
                <MyBookCard key={book.id} book={book} />
              ))}
            </Section>
          ) : null}
        </>
      )}
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof Clock; title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink/70 dark:text-white/70">
        <Icon className="h-4 w-4" />
        {title}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

function MyBookCard({ book, showProgress = false }: { book: MyBook; showProgress?: boolean }) {
  const t = useT();
  const percent = book.pageCount ? Math.min(100, Math.round((book.lastPage / book.pageCount) * 100)) : 0;

  return (
    <Link
      href={`/read/${book.id}`}
      className="group flex flex-col rounded-2xl border border-line bg-white p-4 transition hover:border-moss/30 hover:shadow-soft dark:border-white/10 dark:bg-[#0c0c0e]"
    >
      <div className="flex items-start gap-3">
        <BookCover
          bookId={book.id}
          ready={book.status === "ready"}
          alt={book.title}
          className="h-16 w-12 shrink-0 overflow-hidden rounded border border-line dark:border-white/10"
          iconClassName="h-4 w-4"
        />
        <div className="min-w-0 flex-1">
          <h3 dir="auto" className="line-clamp-2 text-sm font-semibold leading-5 text-ink dark:text-white">
            {book.title}
          </h3>
          {book.author ? <p className="mt-0.5 truncate text-xs text-ink/45 dark:text-white/45">{book.author}</p> : null}
        </div>
        {book.favorite ? <Heart className="h-4 w-4 shrink-0 fill-current text-moss dark:text-sea" /> : null}
      </div>

      {showProgress ? (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] text-ink/45 dark:text-white/45">
            <span>
              {t("ask.page")} {nf.format(book.lastPage)} / {nf.format(book.pageCount)}
            </span>
            <span className="tabular-nums">{percent}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line dark:bg-white/10">
            <div className="h-full rounded-full bg-moss dark:bg-sea" style={{ width: `${percent}%` }} />
          </div>
        </div>
      ) : null}

      <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-moss transition group-hover:gap-1.5 dark:text-sea">
        {showProgress ? t("mb.continue") : t("mb.read")}
        <BookOpenText className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}
