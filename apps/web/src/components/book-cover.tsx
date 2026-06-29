"use client";

import { useEffect, useState } from "react";
import { BookOpenText } from "lucide-react";
import { getBookPageImage } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";

/**
 * Renders a book's real cover (its first rendered page). Falls back to a book
 * icon while loading, for non-ready books, or if the image can't be fetched.
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
  const { token } = useAuth();
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!ready || !token) {
      return;
    }
    let active = true;
    let objectUrl: string | undefined;
    const controller = new AbortController();

    getBookPageImage(bookId, 1, token, controller.signal)
      .then((blob) => {
        if (!active) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (active) {
          setFailed(true);
        }
      });

    return () => {
      active = false;
      controller.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [bookId, ready, token]);

  if (url && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={alt} className={`${className} object-cover`} loading="lazy" />;
  }

  return (
    <span className={`${className} flex items-center justify-center bg-paper text-moss dark:bg-white/5 dark:text-sea`}>
      <BookOpenText className={iconClassName} />
    </span>
  );
}
