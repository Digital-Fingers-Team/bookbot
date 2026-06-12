import Fuse from "fuse.js";
import { Chunk } from "../../models/chunk.model.js";
import type { RetrievedChunk } from "../../types/rag.js";
import { escapeRegExp, normalizeText } from "../../utils/text.js";
import { buildHighlights } from "./highlight.service.js";
import { tokenizeQuery } from "./tokenizer.service.js";

type LeanChunk = {
  _id: unknown;
  bookId: unknown;
  bookName: string;
  pageNumber: number;
  chunkText: string;
  normalizedText: string;
};

export async function retrieveRelevantChunks(question: string, limit = 8): Promise<RetrievedChunk[]> {
  const boundedLimit = Math.min(Math.max(limit, 5), 15);
  const keywords = tokenizeQuery(question);

  if (!keywords.length) {
    return [];
  }

  const searchQuestion = `${question} ${keywords.join(" ")}`;
  const candidates = await findCandidates(searchQuestion, keywords);
  if (!candidates.length) {
    return [];
  }

  const fuse = new Fuse(candidates, {
    keys: [
      { name: "chunkText", weight: 0.9 },
      { name: "bookName", weight: 0.1 }
    ],
    includeScore: true,
    threshold: 0.45,
    ignoreLocation: true,
    minMatchCharLength: 3
  });

  const fuseScores = new Map<string, number>();
  for (const result of fuse.search(searchQuestion)) {
    fuseScores.set(String(result.item._id), 1 - (result.score ?? 1));
  }

  return candidates
    .map((chunk) => {
      const id = String(chunk._id);
      const keywordScore = scoreKeywords(chunk.normalizedText, keywords);
      const phraseScore = scorePhrases(chunk.normalizedText, searchQuestion);
      const fuseScore = fuseScores.get(id) ?? 0;
      const score = Math.round((keywordScore * 0.55 + phraseScore * 0.2 + fuseScore * 0.25) * 100);

      return {
        id,
        bookId: String(chunk.bookId),
        bookName: chunk.bookName,
        pageNumber: chunk.pageNumber,
        chunkText: chunk.chunkText,
        score,
        highlights: buildHighlights(chunk.chunkText, keywords)
      };
    })
    .filter((chunk) => chunk.score >= 12)
    .sort((a, b) => b.score - a.score || a.pageNumber - b.pageNumber)
    .slice(0, boundedLimit);
}

async function findCandidates(question: string, keywords: string[]): Promise<LeanChunk[]> {
  const projection = {
    bookId: 1,
    bookName: 1,
    pageNumber: 1,
    chunkText: 1,
    normalizedText: 1,
    score: { $meta: "textScore" }
  };

  try {
    const textCandidates = await Chunk.find(
      { $text: { $search: question } },
      projection,
      { lean: true }
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(250);

    if (textCandidates.length >= 40) {
      return textCandidates as LeanChunk[];
    }

    const fallback = await regexCandidates(keywords, 250 - textCandidates.length);
    return dedupe([...textCandidates, ...fallback] as LeanChunk[]);
  } catch {
    return regexCandidates(keywords, 250);
  }
}

async function regexCandidates(keywords: string[], limit: number): Promise<LeanChunk[]> {
  if (limit <= 0) {
    return [];
  }

  const important = keywords.slice(0, 8);
  const regexes = important.map((keyword) => new RegExp(escapeRegExp(keyword), "i"));

  return Chunk.find(
    {
      $or: [
        { normalizedText: { $in: regexes } },
        { chunkText: { $in: regexes } },
        { bookName: { $in: regexes } }
      ]
    },
    {
      bookId: 1,
      bookName: 1,
      pageNumber: 1,
      chunkText: 1,
      normalizedText: 1
    },
    { lean: true }
  ).limit(limit);
}

function dedupe(chunks: LeanChunk[]) {
  const seen = new Set<string>();
  return chunks.filter((chunk) => {
    const id = String(chunk._id);
    if (seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
}

function scoreKeywords(text: string, keywords: string[]) {
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

function scorePhrases(text: string, question: string) {
  const normalizedQuestion = normalizeText(question);
  const phrases = normalizedQuestion
    .split(/[?.,;:!]/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 12);

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
