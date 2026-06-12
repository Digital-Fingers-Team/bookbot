import type { RetrievedChunk, Source } from "../../types/rag.js";
import { cleanWhitespace, excerpt } from "../../utils/text.js";

export function buildSources(chunks: RetrievedChunk[], maxSources = 5): Source[] {
  return chunks.slice(0, maxSources).map((chunk) => ({
    bookName: chunk.bookName,
    pageNumber: chunk.pageNumber,
    supportingText: relevantExcerpt(chunk)
  }));
}

export function normalizeModelAnswer(content: string) {
  const trimmed = content.trim();
  if (/^Answer:/i.test(trimmed)) {
    return trimmed;
  }

  return `Answer: ${trimmed}`;
}

function relevantExcerpt(chunk: RetrievedChunk, maxLength = 420) {
  if (!chunk.highlights.length) {
    return excerpt(chunk.chunkText, maxLength);
  }

  const bestHighlight =
    chunk.highlights.find((highlight) => highlight.term.length >= 6) ?? chunk.highlights[0];
  if (!bestHighlight) {
    return excerpt(chunk.chunkText, maxLength);
  }

  const anchor = Math.max(0, Math.floor((bestHighlight.start + bestHighlight.end) / 2));
  const half = Math.floor(maxLength / 2);
  let start = Math.max(0, anchor - half);
  let end = Math.min(chunk.chunkText.length, start + maxLength);

  if (end - start < maxLength) {
    start = Math.max(0, end - maxLength);
  }

  start = moveToBoundary(chunk.chunkText, start, "start");
  end = moveToBoundary(chunk.chunkText, end, "end");

  const prefix = start > 0 ? "... " : "";
  const suffix = end < chunk.chunkText.length ? " ..." : "";
  return cleanWhitespace(`${prefix}${chunk.chunkText.slice(start, end)}${suffix}`);
}

function moveToBoundary(text: string, index: number, direction: "start" | "end") {
  if (direction === "start") {
    const boundary = text.lastIndexOf(" ", index);
    return boundary > 0 ? boundary + 1 : index;
  }

  const boundary = text.indexOf(" ", index);
  return boundary > index ? boundary : index;
}
