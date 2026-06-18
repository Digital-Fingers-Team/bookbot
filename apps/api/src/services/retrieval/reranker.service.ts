import type { RetrievedChunk } from "../../types/rag.js";
import { escapeRegExp, normalizeText, isArabicText } from "../../utils/text.js";
import { buildHighlights } from "./highlight.service.js";
import { tokenizeQuery } from "./tokenizer.service.js";

export type RerankInput = {
  question: string;
  candidates: RetrievedChunk[];
  topK: number;
};

export interface Reranker {
  rerank(input: RerankInput): Promise<RetrievedChunk[]>;
}

export class HybridReranker implements Reranker {
  async rerank(input: RerankInput): Promise<RetrievedChunk[]> {
    const keywords = tokenizeQuery(input.question);
    const phrases = meaningfulPhrases(input.question);
    const bookCounts = new Map<string, number>();
    const isArabic = isArabicText(input.question);

    return input.candidates
      .map((chunk) => {
        const normalized = normalizeText(chunk.chunkText);
        const keywordScore = scoreKeywords(normalized, keywords);
        const phraseScore = scorePhrases(normalized, phrases);
        const vectorScore = normalizeScore(chunk.vectorScore ?? chunk.score);
        const alreadySelectedFromBook = bookCounts.get(chunk.bookId) ?? 0;
        const diversityPenalty = Math.min(alreadySelectedFromBook * 0.03, 0.12);
        
        const vectorWeight = isArabic ? 0.75 : 0.68;
        const keywordWeight = isArabic ? 0.18 : 0.22;
        const phraseWeight = isArabic ? 0.07 : 0.1;
        
        const score = clamp(
          vectorScore * vectorWeight + 
          keywordScore * keywordWeight + 
          phraseScore * phraseWeight - 
          diversityPenalty
        );
        bookCounts.set(chunk.bookId, alreadySelectedFromBook + 1);

        return {
          ...chunk,
          score,
          highlights: buildHighlights(chunk.chunkText, keywords)
        };
      })
      .sort((a, b) => b.score - a.score || a.pageNumber - b.pageNumber)
      .slice(0, input.topK);
  }
}

export class FutureCrossEncoderReranker implements Reranker {
  async rerank(input: RerankInput): Promise<RetrievedChunk[]> {
    return input.candidates
      .map((chunk) => ({ ...chunk, score: normalizeScore(chunk.vectorScore ?? chunk.score) }))
      .sort((a, b) => b.score - a.score || a.pageNumber - b.pageNumber)
      .slice(0, input.topK);
  }
}

export function createReranker(): Reranker {
  return new HybridReranker();
}

function meaningfulPhrases(question: string) {
  return normalizeText(question)
    .split(/[?.,;:!]/u)
    .map((part) => part.trim())
    .filter((part) => part.length >= 10);
}

function scoreKeywords(text: string, keywords: string[]) {
  if (!keywords.length) {
    return 0;
  }

  let hits = 0;
  let weightedHits = 0;

  for (const keyword of keywords) {
    const count = countOccurrences(text, keyword);
    if (count > 0) {
      hits += 1;
      weightedHits += Math.min(count, 5);
    }
  }

  const coverage = hits / keywords.length;
  const density = Math.min(weightedHits / Math.max(keywords.length * 2, 1), 1);
  return coverage * 0.7 + density * 0.3;
}

function scorePhrases(text: string, phrases: string[]) {
  if (!phrases.length) {
    return 0;
  }

  const phraseHits = phrases.filter((phrase) => text.includes(phrase)).length;
  return phraseHits / phrases.length;
}

function countOccurrences(text: string, keyword: string) {
  const matches = text.match(new RegExp(escapeRegExp(keyword), "g"));
  return matches?.length ?? 0;
}

function normalizeScore(score: number) {
  if (score > 1) {
    return clamp(score / 100);
  }

  return clamp(score);
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}
