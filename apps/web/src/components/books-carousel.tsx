"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookOpenText, ChevronLeft, ChevronRight } from "lucide-react";
import { getShowcaseBooks, bookCoverUrl, type ShowcaseBook } from "@/lib/api";
import { useT } from "@/lib/i18n";

/**
 * Horizontal books carousel for the landing page. Pulls the public showcase
 * (no auth) and shows real cover images. Styled with the app's green theme.
 */
export function BooksCarousel() {
  const t = useT();
  const [books, setBooks] = useState<ShowcaseBook[]>([]);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    getShowcaseBooks(14)
      .then((result) => active && setBooks(result.books))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  if (!books.length) {
    return null;
  }

  const scroll = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (track) {
      track.scrollBy({ left: direction * track.clientWidth * 0.8, behavior: "smooth" });
    }
  };

  return (
    <section className="pb-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink/70 dark:text-white/70">
          <BookOpenText className="h-4 w-4 text-moss dark:text-sea" />
          {t("landing.libraryTitle")}
        </h2>
        <div className="flex items-center gap-2">
          <CarouselButton onClick={() => scroll(-1)} label="Previous">
            <ChevronLeft className="h-4 w-4" />
          </CarouselButton>
          <CarouselButton onClick={() => scroll(1)} label="Next">
            <ChevronRight className="h-4 w-4" />
          </CarouselButton>
        </div>
      </div>

      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {books.map((book) => (
          <Link
            key={book.id}
            href={`/login?next=/read/${book.id}`}
            className="group w-36 shrink-0 snap-start sm:w-40"
          >
            <div className="overflow-hidden rounded-xl border border-line bg-paper shadow-soft transition group-hover:-translate-y-0.5 group-hover:border-moss/30 dark:border-white/10 dark:bg-white/5">
              <CoverImage id={book.id} title={book.title} />
            </div>
            <p dir="auto" className="mt-2 line-clamp-2 text-xs font-medium leading-5 text-ink dark:text-white">
              {book.title}
            </p>
            {book.author ? (
              <p dir="auto" className="truncate text-[11px] text-ink/50 dark:text-white/50">
                {book.author}
              </p>
            ) : null}
          </Link>
        ))}
      </div>
    </section>
  );
}

function CoverImage({ id, title }: { id: string; title: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className="flex aspect-[3/4] w-full items-center justify-center bg-moss/10 text-moss dark:bg-sea/15 dark:text-sea">
        <BookOpenText className="h-8 w-8" />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={bookCoverUrl(id)}
      alt={title}
      loading="lazy"
      onError={() => setFailed(true)}
      className="aspect-[3/4] w-full object-cover"
    />
  );
}

function CarouselButton({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-ink/60 transition hover:border-moss/40 hover:text-moss dark:border-white/10 dark:bg-white/5 dark:text-white/60 dark:hover:text-sea"
    >
      {children}
    </button>
  );
}
