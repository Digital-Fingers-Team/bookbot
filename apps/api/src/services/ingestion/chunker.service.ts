import { cleanWhitespace } from "../../utils/text.js";

export type PageText = {
  pageNumber: number;
  text: string;
};

export type TextChunk = {
  pageNumber: number;
  chunkText: string;
};

const SENTENCE_BOUNDARY = /(?<=[.!?])\s+/;

export function chunkPages(
  pages: PageText[],
  options: { minChars?: number; maxChars?: number; overlapChars?: number } = {}
): TextChunk[] {
  const minChars = options.minChars ?? 500;
  const maxChars = options.maxChars ?? 950;
  const overlapChars = options.overlapChars ?? 120;
  const chunks: TextChunk[] = [];

  for (const page of pages) {
    const text = cleanWhitespace(page.text);
    if (!text) {
      continue;
    }

    if (text.length <= maxChars) {
      chunks.push({ pageNumber: page.pageNumber, chunkText: text });
      continue;
    }

    const sentences = text.split(SENTENCE_BOUNDARY).filter(Boolean);
    let current = "";

    for (const sentence of sentences) {
      const next = current ? `${current} ${sentence}` : sentence;

      if (next.length <= maxChars) {
        current = next;
        continue;
      }

      if (current.length >= minChars) {
        chunks.push({ pageNumber: page.pageNumber, chunkText: current });
        current = withOverlap(current, overlapChars, sentence);
      } else {
        const hardChunks = splitHard(next, maxChars, overlapChars);
        for (const hardChunk of hardChunks.slice(0, -1)) {
          chunks.push({ pageNumber: page.pageNumber, chunkText: hardChunk });
        }
        current = hardChunks.at(-1) ?? "";
      }
    }

    if (current.trim()) {
      chunks.push({ pageNumber: page.pageNumber, chunkText: cleanWhitespace(current) });
    }
  }

  return chunks.filter((chunk) => chunk.chunkText.length > 30);
}

function withOverlap(previous: string, overlapChars: number, nextSentence: string) {
  const overlap = previous.slice(Math.max(0, previous.length - overlapChars));
  return cleanWhitespace(`${overlap} ${nextSentence}`);
}

function splitHard(text: string, maxChars: number, overlapChars: number) {
  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const end = Math.min(cursor + maxChars, text.length);
    chunks.push(cleanWhitespace(text.slice(cursor, end)));

    if (end === text.length) {
      break;
    }

    cursor = Math.max(0, end - overlapChars);
  }

  return chunks;
}
