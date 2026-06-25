import type { EvidenceBook, RetrievedChunk, StructuredSource } from "../../types/rag.js";
import { bestSnippet } from "../../utils/text.js";

const DEFAULT_BOOK_LIMIT = 3;

export function buildEvidenceBooks(chunks: RetrievedChunk[], bookLimit = DEFAULT_BOOK_LIMIT): EvidenceBook[] {
  const byBook = new Map<string, RetrievedChunk[]>();

  for (const chunk of chunks) {
    const existing = byBook.get(chunk.bookId) ?? [];
    existing.push(chunk);
    byBook.set(chunk.bookId, existing);
  }

  return Array.from(byBook.entries())
    .map(([bookId, bookChunks]) => {
      const sorted = [...bookChunks].sort((a, b) => b.score - a.score);
      return {
        bookTitle: sorted[0]?.bookName ?? "Unknown book",
        bookId,
        score: bookScore(sorted),
        evidence: sorted.map((chunk) => ({
          pageNumber: chunk.pageNumber,
          text: chunk.chunkText,
          chunkId: chunk.id,
          score: roundScore(chunk.score),
          highlights: chunk.highlights
        }))
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, bookLimit);
}

export function buildStructuredSources(books: EvidenceBook[]): StructuredSource[] {
  const seen = new Set<string>();
  const sources: StructuredSource[] = [];

  for (const book of books) {
    for (const evidence of book.evidence) {
      const key = `${book.bookId}:${evidence.pageNumber}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      sources.push({
        bookTitle: book.bookTitle,
        bookId: book.bookId,
        pageNumber: evidence.pageNumber,
        bookName: book.bookTitle,
        supportingText: bestSnippet(evidence.text, evidence.highlights)
      });
    }
  }

  return sources;
}

function bookScore(chunks: RetrievedChunk[]) {
  const topScores = chunks.slice(0, 3).map((chunk) => chunk.score);
  const strongest = topScores[0] ?? 0;
  const support = topScores.slice(1).reduce((total, score) => total + score, 0) / Math.max(topScores.length, 1);
  return roundScore(Math.min(1, strongest * 0.75 + support * 0.25 + Math.min(chunks.length, 5) * 0.01));
}

function roundScore(score: number) {
  return Math.round(score * 100) / 100;
}
