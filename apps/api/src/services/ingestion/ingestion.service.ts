import { Book } from "../../models/book.model.js";
import { Chunk } from "../../models/chunk.model.js";
import { UsageEvent } from "../../models/usage-event.model.js";
import { CHUNKING_VERSION, PROCESSING_VERSION, embeddingVersion } from "../../config/rag.js";
import { env } from "../../config/env.js";
import { embedTexts } from "../embeddings/openrouter-embedding.service.js";
import { ApiError } from "../../utils/api-error.js";
import { titleFromFileName } from "../../utils/file-name.js";
import { normalizeText } from "../../utils/text.js";
import { chunkPages } from "./chunker.service.js";
import { extractPdfPages } from "./pdf.service.js";
import { deleteStoredPdf, storePdfSource } from "./pdf-storage.service.js";

const EMBEDDING_BATCH_SIZE = 64;

export async function ingestPdf(input: { buffer: Buffer; originalFileName: string }) {
  const startedAt = Date.now();
  const { pages, pageCount } = await extractPdfPages(input.buffer);
  const chunks = chunkPages(pages);

  if (!pages.length || !chunks.length) {
    await UsageEvent.create({
      type: "upload",
      status: "failure",
      latencyMs: Date.now() - startedAt
    });
    throw new ApiError(422, "EMPTY_BOOK", "This PDF does not contain extractable text.");
  }

  const title = titleFromFileName(input.originalFileName);
  const storedPdf = await storePdfSource(input);
  let bookId: unknown;
  try {
    const embeddingResults = await embedChunks(chunks.map((chunk) => chunk.chunkText));
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
      chunkCount: chunks.length,
      pageCount
    });
    bookId = book._id;

    await Chunk.insertMany(
      chunks.map((chunk) => ({
        bookId: book._id,
        bookName: title,
        pageNumber: chunk.pageNumber,
        chunkIndex: chunk.chunkIndex,
        chunkText: chunk.chunkText,
        normalizedText: normalizeText(chunk.chunkText),
        embedding: embeddingResults[chunk.chunkIndex],
        embeddingModel: env.OPENROUTER_EMBEDDING_MODEL,
        embeddingDimensions: env.OPENROUTER_EMBEDDING_DIMENSIONS,
        chunkingVersion: CHUNKING_VERSION,
        embeddingVersion: embeddingVersion(),
        processingVersion: PROCESSING_VERSION
      })),
      { ordered: false }
    );

    await UsageEvent.create({
      type: "upload",
      status: "success",
      chunkCount: chunks.length,
      pageCount,
      latencyMs: Date.now() - startedAt
    });

    return {
      bookId: book._id.toString(),
      title,
      originalFileName: input.originalFileName,
      pageCount,
      chunkCount: chunks.length
    };
  } catch (error) {
    if (bookId) {
      await Book.findByIdAndDelete(bookId);
      await Chunk.deleteMany({ bookId });
    }
    await deleteStoredPdf(storedPdf.originalPdfPath);
    await UsageEvent.create({
      type: "upload",
      status: "failure",
      chunkCount: chunks.length,
      pageCount,
      latencyMs: Date.now() - startedAt
    });
    throw error;
  }
}

async function embedChunks(texts: string[]) {
  const embeddings: number[][] = [];

  for (let cursor = 0; cursor < texts.length; cursor += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(cursor, cursor + EMBEDDING_BATCH_SIZE);
    const result = await embedTexts(batch);
    embeddings.push(...result.embeddings);
  }

  return embeddings;
}
