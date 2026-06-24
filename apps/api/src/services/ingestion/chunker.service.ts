import { cleanWhitespace } from "../../utils/text.js";

export type PageText = {
  pageNumber: number;
  text: string;
};

export type TextChunk = {
  pageNumber: number;
  chunkIndex: number;
  chunkText: string;
};

const SENTENCE_BOUNDARY = /(?<=[.!?])\s+/;
const DEFAULT_MIN_TOKENS = 800;
const DEFAULT_MAX_TOKENS = 1200;
const DEFAULT_OVERLAP_TOKENS = 150;

export function chunkPages(
  pages: PageText[],
  options: { minTokens?: number; maxTokens?: number; overlapTokens?: number; minChars?: number; maxChars?: number; overlapChars?: number } = {}
): TextChunk[] {
  const minTokens = options.minTokens ?? tokenEquivalent(options.minChars) ?? DEFAULT_MIN_TOKENS;
  const maxTokens = options.maxTokens ?? tokenEquivalent(options.maxChars) ?? DEFAULT_MAX_TOKENS;
  const overlapTokens = options.overlapTokens ?? tokenEquivalent(options.overlapChars) ?? DEFAULT_OVERLAP_TOKENS;
  const chunks: TextChunk[] = [];

  for (const page of pages) {
    const text = cleanWhitespace(page.text);
    if (!text) {
      continue;
    }

    if (countTokens(text) <= maxTokens) {
      chunks.push({ pageNumber: page.pageNumber, chunkIndex: chunks.length, chunkText: text });
      continue;
    }

    const sentences = text.split(SENTENCE_BOUNDARY).filter(Boolean);
    let current: string[] = [];

    for (const sentence of sentences) {
      const currentText = current.join(" ");
      const next = currentText ? `${currentText} ${sentence}` : sentence;
      const nextTokens = countTokens(next);

      if (nextTokens <= maxTokens) {
        current.push(sentence);
        continue;
      }

      if (countTokens(currentText) >= minTokens) {
        chunks.push({ pageNumber: page.pageNumber, chunkIndex: chunks.length, chunkText: currentText });
        current = [...overlapSentences(current, overlapTokens), sentence];
      } else {
        const hardChunks = splitLongSentence(next, maxTokens, overlapTokens);
        for (const hardChunk of hardChunks.slice(0, -1)) {
          chunks.push({ pageNumber: page.pageNumber, chunkIndex: chunks.length, chunkText: hardChunk });
        }
        current = hardChunks.at(-1) ? [hardChunks.at(-1) as string] : [];
      }
    }

    const finalText = cleanWhitespace(current.join(" "));
    if (finalText) {
      chunks.push({ pageNumber: page.pageNumber, chunkIndex: chunks.length, chunkText: finalText });
    }
  }

  return chunks
    .filter((chunk) => chunk.chunkText.length > 30)
    .map((chunk, chunkIndex) => ({
      ...chunk,
      chunkIndex
    }));
}

function overlapSentences(sentences: string[], overlapTokens: number) {
  const overlap: string[] = [];
  let tokens = 0;

  for (let index = sentences.length - 1; index >= 0; index -= 1) {
    const sentence = sentences[index];
    if (!sentence) {
      continue;
    }
    const sentenceTokens = countTokens(sentence);
    if (tokens > 0 && tokens + sentenceTokens > overlapTokens) {
      break;
    }
    overlap.unshift(sentence);
    tokens += sentenceTokens;
  }

  return overlap;
}

function splitLongSentence(text: string, maxTokens: number, overlapTokens: number) {
  const words = cleanWhitespace(text).split(" ");
  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < words.length) {
    const end = Math.min(cursor + maxTokens, words.length);
    chunks.push(words.slice(cursor, end).join(" "));

    if (end === words.length) {
      break;
    }

    cursor = Math.max(0, end - overlapTokens);
  }

  return chunks;
}

function countTokens(text: string) {
  if (!text.trim()) {
    return 0;
  }

  return text.trim().split(/\s+/).length;
}

function tokenEquivalent(chars?: number) {
  if (!chars) {
    return undefined;
  }

  return Math.max(1, Math.round(chars / 5));
}
