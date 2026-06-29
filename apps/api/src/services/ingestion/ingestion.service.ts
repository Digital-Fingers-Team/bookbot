import { readFile } from "node:fs/promises";

import type { HydratedDocument } from "mongoose";

import { Book, type BookDocument } from "../../models/book.model.js";
import { Chunk } from "../../models/chunk.model.js";
import { UsageEvent } from "../../models/usage-event.model.js";
import {
  CHUNKING_VERSION,
  PROCESSING_VERSION,
  embeddingVersion
} from "../../config/rag.js";
import { env } from "../../config/env.js";
import { embedTexts } from "../embeddings/openrouter-embedding.service.js";
import { titleFromFileName } from "../../utils/file-name.js";
import { cleanExtractedText, normalizeText } from "../../utils/text.js";
import { chunkPages } from "./chunker.service.js";
import { extractBook } from "./extraction.service.js";
import { storePdfSource } from "./pdf-storage.service.js";
import { pushBookToOmp } from "../omp/omp-push.service.js";

const MAX_EMBEDDING_CHARS = 50000;
const PROGRESS_INTERVAL_MS = 1500;

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
}): Promise<CreatedBook> {
  const title = titleFromFileName(input.originalFileName);
  const storedPdf = await storePdfSource(input);

  const book = await Book.create({
    title,
    originalFileName: input.originalFileName,
    originalPdfPath: storedPdf.originalPdfPath,
    storageProvider: storedPdf.storageProvider,
    uploadChecksum: storedPdf.uploadChecksum,
    uploadedAt: storedPdf.uploadedAt,
    chunkingVersion: CHUNKING_VERSION,
    embeddingVersion: embeddingVersion(),
    processingVersion: PROCESSING_VERSION,
    status: "processing",
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
    await markFailed(book, "The stored PDF could not be found.");
    return;
  }

  try {
    const buffer = await readFile(book.originalPdfPath);

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

    const { pages, pageCount } = await extractBook(buffer, onProgress);
    const chunks = chunkPages(pages.map((entry) => entry.page));

    if (!chunks.length) {
      await markFailed(book, "This PDF does not contain readable text.");
      await recordUsage("failure", { pageCount, startedAt });
      return;
    }

    // Display text stays clean and readable; the normalized form is kept
    // separately for keyword search. The clean text is what we embed so chunk
    // vectors match the raw user question used at query time.
    const cleanedChunks = chunks.map((chunk) => ({
      ...chunk,
      chunkText: cleanExtractedText(chunk.chunkText)
    }));

    const embeddingResults = await embedChunks(cleanedChunks.map((chunk) => chunk.chunkText));

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
        embeddingModel: env.OPENROUTER_EMBEDDING_MODEL,
        embeddingDimensions: env.OPENROUTER_EMBEDDING_DIMENSIONS,
        chunkingVersion: CHUNKING_VERSION,
        embeddingVersion: embeddingVersion(),
        processingVersion: PROCESSING_VERSION
      })),
      { ordered: false }
    );

    book.status = "ready";
    book.pageCount = pageCount;
    book.processedPages = pageCount;
    book.chunkCount = cleanedChunks.length;
    book.error = undefined;
    await book.save();

    // Mirror the finished book into OMP (Arado). Best-effort: never blocks or
    // fails ingestion, and records its own status on the book.
    await pushBookToOmp(book);

    await recordUsage("success", { pageCount, chunkCount: cleanedChunks.length, startedAt });
  } catch (error) {
    console.error(`[ingestion] processing failed for ${bookId}:`, error);
    await markFailed(book, error instanceof Error ? error.message : "Processing failed.");
    await recordUsage("failure", { startedAt });
  }
}

/**
 * Recover from a crash/restart: any book stuck in `processing` has no running
 * job, so mark it failed and ask the user to re-upload.
 */
export async function failStaleProcessingBooks(): Promise<void> {
  const result = await Book.updateMany(
    { status: "processing" },
    { $set: { status: "failed", error: "Processing was interrupted. Please delete and re-upload this book." } }
  );

  if (result.modifiedCount) {
    console.log(`[ingestion] marked ${result.modifiedCount} interrupted book(s) as failed`);
  }
}

async function markFailed(book: HydratedDocument<BookDocument>, message: string) {
  book.status = "failed";
  book.error = message.slice(0, 500);
  await book.save().catch(() => undefined);
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
