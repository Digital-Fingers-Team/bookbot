import { Book } from "../../models/book.model.js";
import { Chunk } from "../../models/chunk.model.js";
import { UsageEvent } from "../../models/usage-event.model.js";
import { ApiError } from "../../utils/api-error.js";
import { normalizeText } from "../../utils/text.js";
import { chunkPages } from "./chunker.service.js";
import { extractPdfPages } from "./pdf.service.js";

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
  const book = await Book.create({
    title,
    originalFileName: input.originalFileName,
    chunkCount: chunks.length,
    pageCount
  });

  try {
    await Chunk.insertMany(
      chunks.map((chunk) => ({
        bookId: book._id,
        bookName: title,
        pageNumber: chunk.pageNumber,
        chunkText: chunk.chunkText,
        normalizedText: normalizeText(chunk.chunkText)
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
    await Book.findByIdAndDelete(book._id);
    await Chunk.deleteMany({ bookId: book._id });
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

function titleFromFileName(fileName: string) {
  return fileName.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim() || "Untitled book";
}
