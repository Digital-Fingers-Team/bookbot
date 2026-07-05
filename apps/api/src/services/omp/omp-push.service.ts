import type { HydratedDocument } from "mongoose";
import { env } from "../../config/env.js";
import { Book, type BookDocument } from "../../models/book.model.js";
import { storage } from "../storage/storage.service.js";
import {
  addOmpPublicationAuthor,
  createOmpSubmission,
  setOmpPublicationTitle,
  uploadOmpSubmissionFile
} from "./omp.client.js";

/** Split a free-text author name into given/family parts for OMP. */
function splitAuthorName(raw: string): { givenName: string; familyName: string } {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { givenName: "Unknown", familyName: "Author" };
  }
  const [first = "Author", ...rest] = parts;
  return { givenName: first, familyName: rest.length ? rest.join(" ") : first };
}

/**
 * Mirror a processed book into OMP (Arado) as a submission: create the
 * submission, set its title, and upload the source PDF. The submission lands in
 * OMP's workflow so it can go through the editorial/review cycle.
 *
 * Best-effort and idempotent: skips books already pushed or missing their PDF,
 * and records failures on the book instead of throwing, so it never breaks the
 * ingestion pipeline.
 */
export async function pushBookToOmp(book: HydratedDocument<BookDocument>): Promise<void> {
  if (!env.OMP_PUSH_ENABLED || !env.OMP_API_TOKEN) {
    return;
  }
  if (book.ompSubmissionId) {
    return; // already mirrored
  }
  if (!book.originalPdfPath) {
    return;
  }

  try {
    const fileBytes = await storage.get(book.originalPdfPath);

    const { submissionId, publicationId } = await createOmpSubmission();
    await setOmpPublicationTitle(submissionId, publicationId, book.title);

    // Add the author. aradobot stores a single free-text name, so split it into
    // given/family parts and use a synthetic email (OMP requires one).
    const { givenName, familyName } = splitAuthorName(book.author || "");
    await addOmpPublicationAuthor(submissionId, publicationId, {
      givenName,
      familyName,
      email: `author+${book.id}@arado.local`
    });

    await uploadOmpSubmissionFile(submissionId, fileBytes, book.originalFileName || `${book.title}.pdf`);

    book.ompSubmissionId = submissionId;
    book.ompPushStatus = "pushed";
    book.ompPushedAt = new Date();
    book.ompPushError = undefined;
    await book.save();
    console.log(`[omp-push] book ${book.id} -> OMP submission ${submissionId}`);
  } catch (error) {
    book.ompPushStatus = "failed";
    book.ompPushError = (error instanceof Error ? error.message : String(error)).slice(0, 500);
    await book.save().catch(() => undefined);
    console.error(`[omp-push] failed for book ${book.id}:`, error);
  }
}

/** Retry pushing any book that finished processing but isn't in OMP yet. */
export async function pushPendingBooksToOmp(): Promise<void> {
  if (!env.OMP_PUSH_ENABLED || !env.OMP_API_TOKEN) {
    return;
  }
  const books = await Book.find({ status: "ready", ompSubmissionId: { $exists: false } }).limit(25);
  for (const book of books) {
    await pushBookToOmp(book);
  }
}
