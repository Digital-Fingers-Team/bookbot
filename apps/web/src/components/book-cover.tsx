"use client";

import { useEffect, useState } from "react";
import { BookOpenText } from "lucide-react";
import { bookCoverUrl } from "@/lib/api";

/**
 * Renders a book's real cover (its first rendered page) via the public cover
 * endpoint, so it shows even for locked books the user hasn't bought yet.
 * Falls back to a book icon while non-ready or if the image can't be fetched.
 */
export function BookCover({
  bookId,
  ready,
  alt,
  className = "",
  iconClassName = "h-5 w-5"
}: {
  bookId: string;
  ready: boolean;
  alt: string;
  className?: string;
  iconClassName?: string;
}) {
  const [failed, setFailed] = useState(false);

  // Reset the failed flag if the book changes (e.g. list re-renders).
  useEffect(() => {
    setFailed(false);
  }, [bookId]);

  if (ready && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={bookCoverUrl(bookId)}
        alt={alt}
        className={`${className} object-cover`}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span className={`${className} flex items-center justify-center bg-paper text-moss dark:bg-white/5 dark:text-sea`}>
      <BookOpenText className={iconClassName} />
    </span>
  );
}
