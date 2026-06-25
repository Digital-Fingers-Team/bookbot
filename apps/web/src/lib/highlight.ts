import type { Highlight } from "./types";

// Very common words that would otherwise create noisy highlights when they
// happen to appear in both the answer and an evidence snippet.
const STOPWORDS = new Set([
  // English
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "at", "for", "with", "as", "by", "is", "are", "was",
  "were", "be", "been", "being", "it", "its", "this", "that", "these", "those", "from", "into", "than", "then", "so",
  "such", "not", "no", "can", "will", "would", "should", "could", "may", "might", "do", "does", "did", "has", "have",
  "had", "you", "your", "we", "our", "they", "their", "he", "she", "his", "her", "if", "about", "which", "who", "what",
  "when", "where", "why", "how", "also", "more", "most", "some", "any", "all",
  // Arabic
  "في", "من", "إلى", "على", "هذا", "هذه",
  "ذلك", "تلك", "التي", "الذي", "و", "أو",
  "لا", "ما", "هو", "هي", "أن", "إن", "قد",
  "عن", "مع", "بعد", "قبل", "بين", "كل",
  "ثم", "أي", "به", "لها", "له", "كما"
]);

function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "") // strip combining diacritics (Latin accents + Arabic harakat)
    .replace(/ـ/g, ""); // strip Arabic tatweel
}

function significantWords(value: string): Set<string> {
  const words = new Set<string>();
  for (const raw of value.split(/[^\p{L}\p{N}]+/u)) {
    const word = normalizeWord(raw);
    if (word.length >= 3 && !STOPWORDS.has(word)) {
      words.add(word);
    }
  }
  return words;
}

/**
 * Find spans within `text` (an evidence snippet) whose words also appear in the
 * model's `answer`, so the UI can highlight the part of the evidence the answer
 * actually drew on. Adjacent shared words are merged into phrases, bridging a
 * single connective word so quotes stay contiguous.
 */
export function answerOverlapHighlights(text: string, answer: string): Highlight[] {
  if (!text || !answer) {
    return [];
  }

  const answerWords = significantWords(answer);
  if (!answerWords.size) {
    return [];
  }

  const ranges: Highlight[] = [];
  const wordRe = /\p{L}[\p{L}\p{N}]*/gu;
  let match: RegExpExecArray | null;
  let runStart = -1;
  let runEnd = -1;
  let gap = 0;

  const flush = () => {
    if (runStart >= 0 && runEnd > runStart) {
      ranges.push({ term: text.slice(runStart, runEnd), start: runStart, end: runEnd });
    }
    runStart = -1;
    runEnd = -1;
    gap = 0;
  };

  while ((match = wordRe.exec(text))) {
    const token = match[0];
    const norm = normalizeWord(token);
    const shared = norm.length >= 3 && !STOPWORDS.has(norm) && answerWords.has(norm);

    if (shared) {
      if (runStart < 0) {
        runStart = match.index;
      }
      runEnd = match.index + token.length;
      gap = 0;
    } else if (runStart >= 0) {
      gap += 1;
      if (gap > 1) {
        flush();
      }
    }
  }
  flush();

  return ranges;
}
