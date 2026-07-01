"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import { EffectCoverflow, Navigation, Pagination } from "swiper/modules";
import { BookOpenText } from "lucide-react";
import { getShowcaseBooks, bookCoverUrl, type ShowcaseBook } from "@/lib/api";
import { useT } from "@/lib/i18n";
import "swiper/css";
import "swiper/css/effect-coverflow";
import "swiper/css/pagination";
import "swiper/css/navigation";

/**
 * 3D coverflow books carousel for the landing page. Pulls the public showcase
 * (no auth) and shows real cover images, themed green.
 */
export function BooksCarousel() {
  const t = useT();
  const [books, setBooks] = useState<ShowcaseBook[]>([]);

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

  return (
    <section className="pb-12 pt-2">
      <h2 className="mb-5 flex items-center justify-center gap-2 text-sm font-semibold text-ink/70 dark:text-white/70">
        <BookOpenText className="h-4 w-4 text-moss dark:text-sea" />
        {t("landing.libraryTitle")}
      </h2>

      <Swiper
        modules={[EffectCoverflow, Navigation, Pagination]}
        effect="coverflow"
        grabCursor
        centeredSlides
        slidesPerView="auto"
        loop={books.length > 3}
        spaceBetween={0}
        coverflowEffect={{ rotate: 38, stretch: 0, depth: 130, modifier: 1, slideShadows: true }}
        navigation
        pagination={{ clickable: true }}
        className="books-coverflow"
      >
        {books.map((book) => (
          <SwiperSlide key={book.id} className="books-coverflow__slide">
            <Link href={`/login?next=/read/${book.id}`} className="block">
              <CoverImage id={book.id} title={book.title} />
              <p dir="auto" className="mt-3 line-clamp-2 text-center text-xs font-medium leading-5 text-ink dark:text-white">
                {book.title}
              </p>
              {book.author ? (
                <p dir="auto" className="truncate text-center text-[11px] text-ink/70 dark:text-white/70">
                  {book.author}
                </p>
              ) : null}
            </Link>
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}

function CoverImage({ id, title }: { id: string; title: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className="flex aspect-[3/4] w-full items-center justify-center rounded-lg bg-moss/10 text-moss shadow-soft dark:bg-sea/15 dark:text-sea">
        <BookOpenText className="h-10 w-10" />
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
      className="aspect-[3/4] w-full rounded-lg object-cover shadow-[0_18px_40px_rgba(24,24,27,0.28)]"
    />
  );
}
