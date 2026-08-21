"use client";

import { useEffect, useState } from "react";
import { BookOpenText } from "lucide-react";
import { bookCoverUrl } from "@/lib/api";

/**
 * Renders a book's real cover (its first rendered page) via the public cover
 * endpoint, so it shows even for locked books the user hasn't bought yet.
 * Falls back to a book icon only if the first-page image cannot be fetched.
 */
export function BookCover({
  bookId,
  ready: _ready,
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
  const [imageUrl, setImageUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = "";

    setImageUrl("");
    setFailed(false);

    // Fetch the image into a local object URL. This makes the cover reliable
    // when the API is hosted on a different origin than the web app.
    fetch(bookCoverUrl(bookId), { signal: controller.signal, cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Cover request failed: ${response.status}`);
        }
        return response.blob();
      })
      .then((blob) => {
        if (controller.signal.aborted) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setFailed(true);
        }
      });

    return () => {
      controller.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [bookId]);

  // The cover endpoint is public and safely returns a placeholder only for
  // non-PDF sources. Do not gate this on the processing status: catalog data
  // can briefly be stale, and a ready PDF should still show its first page.
  if (imageUrl && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={imageUrl}
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
