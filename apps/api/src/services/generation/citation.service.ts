import type { RetrievedChunk, Source } from "../../types/rag.js";
import { excerpt } from "../../utils/text.js";

export function buildSources(chunks: RetrievedChunk[], maxSources = 5): Source[] {
  return chunks.slice(0, maxSources).map((chunk) => ({
    bookName: chunk.bookName,
    pageNumber: chunk.pageNumber,
    supportingText: excerpt(chunk.chunkText)
  }));
}

export function normalizeModelAnswer(content: string) {
  const trimmed = content.trim();
  if (/^Answer:/i.test(trimmed)) {
    return trimmed;
  }

  return `Answer: ${trimmed}`;
}
