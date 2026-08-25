import type { HydratedDocument } from "mongoose";

import { Book, type BookDocument } from "../../models/book.model.js";
import { BookPage } from "../../models/book-page.model.js";
import { Chunk } from "../../models/chunk.model.js";
import { UsageEvent } from "../../models/usage-event.model.js";
import {
  CHUNKING_VERSION,
  PROCESSING_VERSION,
  embeddingVersion
} from "../../config/rag.js";
import { getEmbeddingSettings } from "../../config/embedding.js";
import { embedTexts } from "../embeddings/openrouter-embedding.service.js";
import { titleFromFileName } from "../../utils/file-name.js";
import { cleanExtractedText, normalizeText } from "../../utils/text.js";
import { storage } from "../storage/storage.service.js";
import { chunkPages } from "./chunker.service.js";
import { extractDocument } from "./extraction.service.js";
import { storePdfSource } from "./pdf-storage.service.js";
import { pushBookToOmp } from "../omp/omp-push.service.js";
import type { SourceFormat } from "../../utils/source-format.js";
import { notifyAdmins } from "../notifications/notification.service.js";

const MAX_EMBEDDING_CHARS = 50000;
const PROGRESS_INTERVAL_MS = 1500;

class ProcessingCancelledError extends Error {
  constructor() {
    super("Processing was cancelled.");
    this.name = "ProcessingCancelledError";
  }
}

export type CreatedBook = {
  bookId: string;
  title: string;
  originalFileName: string;
  status: "processing";
};

/**
 * Persist the uploaded PDF and create a `processing` book row immediately. The
 * heavy extraction/OCR/embedding work runs afterwards in {@link processBook} so
 * the upload request returns fast and large OCR books cannot time out.
 */
export async function createProcessingBook(input: {
  buffer: Buffer;
  originalFileName: string;
  price?: number;
  format: SourceFormat;
  externalSourceId?: string;
  title?: string;
  author?: string;
  description?: string;
  category?: string;
}): Promise<CreatedBook> {
  const title = input.title?.trim() || titleFromFileName(input.originalFileName);
  const storedPdf = await storePdfSource(input);

  const book = await Book.create({
    title,
    externalSourceId: input.externalSourceId?.trim() || undefined,
    originalFileName: input.originalFileName,
    originalPdfPath: storedPdf.originalPdfPath,
    sourceFormat: input.format,
    storageProvider: storedPdf.storageProvider,
    uploadChecksum: storedPdf.uploadChecksum,
    uploadedAt: storedPdf.uploadedAt,
    chunkingVersion: CHUNKING_VERSION,
    embeddingVersion: embeddingVersion(),
    processingVersion: PROCESSING_VERSION,
    status: "processing",
    author: input.author?.trim().slice(0, 120) ?? "",
    description: input.description?.trim().slice(0, 600) ?? "",
    category: input.category?.trim() ?? "",
    price: input.price && input.price > 0 ? input.price : 0,
    chunkCount: 0,
    pageCount: 0,
    processedPages: 0
  });

  return {
    bookId: book._id.toString(),
    title,
    originalFileName: input.originalFileName,
    status: "processing"
  };
}

/**
 * Extract, OCR-fallback, chunk and embed a previously created book, updating its
 * status and progress as it goes. Never throws: failures are recorded on the
 * book so the UI can surface them.
 */
export async function processBook(bookId: string): Promise<void> {
  const startedAt = Date.now();
  const book = await Book.findById(bookId);

  if (!book) {
    console.error(`[ingestion] processBook: book ${bookId} not found`);
    return;
  }

  if (!book.originalPdfPath) {
    await markFailed(book, "The stored file could not be found.");
    return;
  }

  const format = (book.sourceFormat as SourceFormat) ?? "pdf";

  try {
    await throwIfCancelled(bookId);
    const buffer = await storage.get(book.originalPdfPath);

    let lastProgressAt = 0;
    const onProgress = (done: number, total: number) => {
      const now = Date.now();
      if (done < total && now - lastProgressAt < PROGRESS_INTERVAL_MS) {
        return;
      }
      lastProgressAt = now;
      Book.updateOne({ _id: book._id }, { $set: { processedPages: done, pageCount: total } }).catch(
        () => undefined
      );
    };

    const { pages, pageCount } = await extractDocument(buffer, format, onProgress);
    await throwIfCancelled(bookId);
    const chunks = chunkPages(pages.map((entry) => entry.page));

    if (!chunks.length) {
      await markFailed(book, "This file does not contain readable text.");
      await recordUsage("failure", { pageCount, startedAt });
      return;
    }

    if (format !== "pdf") {
      await BookPage.deleteMany({ bookId: book._id });
      await BookPage.insertMany(
        pages.map((entry) => ({
          bookId: book._id,
          pageNumber: entry.page.pageNumber,
          text: entry.page.text
        })),
        { ordered: false }
      );
    }

    // Display text stays clean and readable; the normalized form is kept
    // separately for keyword search. The clean text is what we embed so chunk
    // vectors match the raw user question used at query time.
    const cleanedChunks = chunks.map((chunk) => ({
      ...chunk,
      chunkText: cleanExtractedText(chunk.chunkText)
    }));

    const embeddingResults = await embedChunks(cleanedChunks.map((chunk) => chunk.chunkText));
    await throwIfCancelled(bookId);

    await Chunk.deleteMany({ bookId: book._id });
    await Chunk.insertMany(
      cleanedChunks.map((chunk, index) => ({
        bookId: book._id,
        bookName: book.title,
        pageNumber: chunk.pageNumber,
        chunkIndex: chunk.chunkIndex,
        chunkText: chunk.chunkText,
        normalizedText: normalizeText(chunk.chunkText),
        embedding: embeddingResults[index],
        embeddingModel: getEmbeddingSettings().model,
        embeddingDimensions: getEmbeddingSettings().dimensions,
        chunkingVersion: CHUNKING_VERSION,
        embeddingVersion: embeddingVersion(),
        processingVersion: PROCESSING_VERSION
      })),
      { ordered: false }
    );

    await throwIfCancelled(bookId);

    const completedBook = await Book.findOneAndUpdate(
      { _id: book._id, status: "processing" },
      {
        $set: {
          status: "ready",
          pageCount,
          processedPages: pageCount,
          chunkCount: cleanedChunks.length,
          readyAt: new Date()
        },
        $unset: { error: 1 }
      },
      { new: true }
    );
    if (!completedBook) {
      throw new ProcessingCancelledError();
    }

    await notifyAdmins({
      type: "book_ready",
      title: "Book uploaded successfully",
      message: `“${completedBook.title}” is ready to read and search.`,
      href: "/library"
    });

    // Mirror the finished book into OMP (Arado). Best-effort: never blocks or
    // fails ingestion, and records its own status on the book.
    await pushBookToOmp(completedBook);

    await recordUsage("success", { pageCount, chunkCount: cleanedChunks.length, startedAt });
  } catch (error) {
    if (error instanceof ProcessingCancelledError) {
      await Chunk.deleteMany({ bookId }).catch(() => undefined);
      await BookPage.deleteMany({ bookId }).catch(() => undefined);
      return;
    }
    console.error(`[ingestion] processing failed for ${bookId}:`, error);
    await markFailed(book, error instanceof Error ? error.message : "Processing failed.");
    await recordUsage("failure", { startedAt });
  }
}

async function throwIfCancelled(bookId: string) {
  const current = await Book.findById(bookId, { status: 1 }).lean();
  if (!current || current.status === "cancelled") {
    throw new ProcessingCancelledError();
  }
}

/**
 * Recover from a crash/restart: any book stuck in `processing` has no running
 * job, so mark it failed and ask the user to re-upload.
 */
export async function failStaleProcessingBooks(): Promise<void> {
  const staleBooks = await Book.find({ status: "processing" }, { title: 1 }).lean();
  const result = await Book.updateMany(
    { status: "processing" },
    { $set: { status: "failed", error: "Processing was interrupted. Please delete and re-upload this book." } }
  );

  if (result.modifiedCount) {
    console.log(`[ingestion] marked ${result.modifiedCount} interrupted book(s) as failed`);
    for (const book of staleBooks) {
      await notifyAdmins({
        type: "book_failed",
        title: "Book processing failed",
        message: `“${book.title}” was interrupted and needs to be uploaded again.`,
        href: "/library"
      });
    }
  }
}

async function markFailed(book: HydratedDocument<BookDocument>, message: string) {
  book.status = "failed";
  book.error = message.slice(0, 500);
  await book.save().catch(() => undefined);
  await notifyAdmins({
    type: "book_failed",
    title: "Book processing failed",
    message: `“${book.title}” could not be processed: ${book.error}`,
    href: "/library"
  });
}

async function recordUsage(
  status: "success" | "failure",
  data: { pageCount?: number; chunkCount?: number; startedAt: number }
) {
  await UsageEvent.create({
    type: "upload",
    status,
    pageCount: data.pageCount ?? 0,
    chunkCount: data.chunkCount ?? 0,
    latencyMs: Date.now() - data.startedAt
  }).catch(() => undefined);
}

async function embedChunks(texts: string[]) {
  const embeddings: number[][] = [];

  let batch: string[] = [];
  let batchChars = 0;

  for (const text of texts) {
    const textChars = text.length;

    if (batch.length > 0 && batchChars + textChars > MAX_EMBEDDING_CHARS) {
      const result = await embedTexts(batch);
      embeddings.push(...result.embeddings);
      batch = [];
      batchChars = 0;
    }

    batch.push(text);
    batchChars += textChars;
  }

  if (batch.length > 0) {
    const result = await embedTexts(batch);
    embeddings.push(...result.embeddings);
  }

  return embeddings;
}
