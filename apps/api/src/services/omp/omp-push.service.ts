import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import type { HydratedDocument } from "mongoose";
import { env } from "../../config/env.js";
import { Book, type BookDocument } from "../../models/book.model.js";
import { createOmpSubmission, setOmpPublicationTitle, uploadOmpSubmissionFile } from "./omp.client.js";

/**
 * Read the book's PDF, tolerating a stored absolute path that no longer exists
 * (e.g. the repo moved) by falling back to the current storage dir + filename.
 */
async function readBookPdf(storedPath: string): Promise<Buffer> {
  try {
    return await readFile(storedPath);
  } catch {
    return readFile(resolve(env.PDF_STORAGE_DIR, basename(storedPath)));
  }
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
    const fileBytes = await readBookPdf(book.originalPdfPath);

    const { submissionId, publicationId } = await createOmpSubmission();
    await setOmpPublicationTitle(submissionId, publicationId, book.title);
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
