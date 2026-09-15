"use client";

import { useEffect, useState } from "react";
import { BookOpenText } from "lucide-react";
import { bookCoverUrl } from "@/lib/api";

/**
 * Renders a book's cover via the public cover endpoint — the uploaded front
 * face when there is one, otherwise the book's first rendered page — so it
 * shows even for locked books the user hasn't bought yet. Falls back to a book
 * icon only if the image cannot be fetched.
 */
export function BookCover({
  bookId,
  ready: _ready,
  alt,
  className = "",
  iconClassName = "h-5 w-5",
  version = 0
}: {
  bookId: string;
  ready: boolean;
  alt: string;
  className?: string;
  iconClassName?: string;
  /** Bump to refetch after the cover changed; the endpoint is cached for a day. */
  version?: number;
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
    fetch(version ? `${bookCoverUrl(bookId)}?v=${version}` : bookCoverUrl(bookId), { signal: controller.signal, cache: "no-store" })
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
  }, [bookId, version]);

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
