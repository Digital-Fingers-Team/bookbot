"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, EffectCoverflow, Navigation, Pagination } from "swiper/modules";
import { BookOpenText } from "lucide-react";
import { getShowcaseBooks, bookCoverUrl, type ShowcaseBook } from "@/lib/api";
import { useT } from "@/lib/i18n";
import "swiper/css";
import "swiper/css/effect-coverflow";
import "swiper/css/pagination";
import "swiper/css/navigation";

type BooksCarouselProps = {
  /**
   * Books to show. Omit on the landing page to pull the public showcase; the
   * library passes the reader's own books so every slide links somewhere they
   * can actually open.
   */
  books?: ShowcaseBook[];
  /** Where a slide links. Defaults to the sign-in-then-read hop for visitors. */
  linkTo?: (id: string) => string;
  /** Heading above the carousel; pass null to drop it. */
  heading?: string | null;
};

/** How long each book sits centred before the carousel moves on. */
const AUTOPLAY_DELAY_MS = 4000;

/**
 * Swiper's loop needs more slides than fit on screen at once, or it leaves
 * gaps and jumps as it wraps. With `slidesPerView="auto"` a handful of books
 * is not enough, so the list is repeated until there are this many slides —
 * the reader never notices, because it is looping anyway.
 */
const MIN_SLIDES_FOR_LOOP = 8;

/** A slide carries its source book plus which repetition it came from. */
type CarouselSlide = { book: ShowcaseBook; key: string };

function buildSlides(books: ShowcaseBook[]): CarouselSlide[] {
  const repeats = Math.max(1, Math.ceil(MIN_SLIDES_FOR_LOOP / books.length));
  const slides: CarouselSlide[] = [];
  for (let pass = 0; pass < repeats; pass += 1) {
    for (const book of books) {
      slides.push({ book, key: `${book.id}#${pass}` });
    }
  }
  return slides;
}

/** Honour the reader's "reduce motion" setting: no carousel moving on its own. */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/**
 * 3D coverflow books carousel. Pulls the public showcase (no auth) unless it
 * is handed books, and shows real cover images, themed green.
 *
 * It advances on its own and wraps forever, so the shelf keeps moving past the
 * last book back to the first.
 */
export function BooksCarousel({ books: provided, linkTo, heading }: BooksCarouselProps = {}) {
  const t = useT();
  const [fetched, setFetched] = useState<ShowcaseBook[]>([]);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (provided) {
      return;
    }
    let active = true;
    getShowcaseBooks(14)
      .then((result) => active && setFetched(result.books))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [provided]);

  const books = provided ?? fetched;
  const href = linkTo ?? ((id: string) => `/login?next=/read/${id}`);
  const title = heading === undefined ? t("landing.libraryTitle") : heading;

  if (!books.length) {
    return null;
  }

  const slides = buildSlides(books);

  return (
    <section className="pb-12 pt-2">
      {title ? (
        <h2 className="mb-5 flex items-center justify-center gap-2 text-sm font-semibold text-ink/70 dark:text-white/70">
          <BookOpenText className="h-4 w-4 text-moss dark:text-sea" />
          {title}
        </h2>
      ) : null}

      <Swiper
        modules={[Autoplay, EffectCoverflow, Navigation, Pagination]}
        effect="coverflow"
        grabCursor
        centeredSlides
        slidesPerView="auto"
        loop
        autoplay={
          prefersReducedMotion
            ? false
            : {
                delay: AUTOPLAY_DELAY_MS,
                // Keep moving after a swipe or an arrow click; stopping for good
                // on the first touch is what makes most carousels feel broken.
                disableOnInteraction: false,
                pauseOnMouseEnter: true
              }
        }
        spaceBetween={0}
        coverflowEffect={{ rotate: 38, stretch: 0, depth: 130, modifier: 1, slideShadows: true }}
        navigation
        pagination={{ clickable: true }}
        className="books-coverflow"
      >
        {slides.map(({ book, key }) => (
          <SwiperSlide key={key} className="books-coverflow__slide">
            <Link href={href(book.id)} className="block">
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
