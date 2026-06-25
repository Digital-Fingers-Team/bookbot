import type { Highlight } from "./types";

function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "") // strip combining diacritics (Latin accents + Arabic harakat)
    .replace(/ـ/g, ""); // strip Arabic tatweel
}

// Very common words that would otherwise create noisy highlights when they
// happen to appear in both the answer and an evidence snippet. Stored in
// normalized form so the membership check matches normalized tokens (e.g. the
// Arabic "إلى" normalizes to "الى" once its hamza is stripped).
const STOPWORDS = new Set(
  [
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
    "ثم", "أي", "به", "لها", "له", "كما",
    "حول", "هذه", "هذا", "حيث", "كذلك"
  ].map(normalizeWord)
);

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

// Split text into sentences, keeping each sentence's [start, end) offsets and
// trimming surrounding whitespace from the span. Arabic and Latin terminators.
function splitSentences(text: string): { start: number; end: number; text: string }[] {
  const sentences: { start: number; end: number; text: string }[] = [];
  const re = /[^.!?؟؛\n]+[.!?؟؛]?\s*/gu;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text))) {
    const raw = match[0];
    const start = match.index + (raw.length - raw.trimStart().length);
    const end = match.index + raw.trimEnd().length;
    if (end > start) {
      sentences.push({ start, end, text: text.slice(start, end) });
    }
  }

  return sentences;
}

/**
 * Highlight the sentence(s) of an evidence snippet that the model's `answer`
 * actually drew on — not every shared word. Scoring is sentence-level and
 * ignores words that are ubiquitous within the snippet (e.g. the topic word),
 * so a list of headings that merely repeats the topic does not light up, while
 * the sentence that shares distinctive wording with the answer does.
 */
export function answerOverlapHighlights(text: string, answer: string): Highlight[] {
  if (!text || !answer) {
    return [];
  }

  const answerWords = significantWords(answer);
  if (!answerWords.size) {
    return [];
  }

  const sentences = splitSentences(text);
  if (!sentences.length) {
    return [];
  }

  // The set of significant words in each sentence.
  const sentenceWords = sentences.map((sentence) => significantWords(sentence.text));

  // How many sentences each shared word appears in. A word present in most
  // sentences (like the snippet's subject) carries no signal about *which*
  // sentence the answer used, so it is excluded from scoring.
  const documentFrequency = new Map<string, number>();
  for (const words of sentenceWords) {
    for (const word of words) {
      if (answerWords.has(word)) {
        documentFrequency.set(word, (documentFrequency.get(word) ?? 0) + 1);
      }
    }
  }
  const ubiquitous = Math.max(2, Math.ceil(sentences.length * 0.5));

  const scored = sentences.map((sentence, index) => {
    const words = sentenceWords[index] ?? new Set<string>();
    let score = 0;
    for (const word of words) {
      if (!answerWords.has(word)) {
        continue;
      }
      const frequency = documentFrequency.get(word) ?? 0;
      if (frequency === 0 || frequency >= ubiquitous) {
        continue; // unmatched, or so common in the snippet it carries no signal
      }
      // Words unique to a single sentence are strong evidence it was the source;
      // words shared across a few sentences count, but for less.
      score += frequency === 1 ? 2 : 1;
    }
    return { sentence, score };
  });

  const maxScore = scored.reduce((max, item) => Math.max(max, item.score), 0);
  // Require real overlap (a distinctive word, or two shared words) so a single
  // incidental match of a common word does not light up a whole sentence.
  if (maxScore < 2) {
    return [];
  }
  const threshold = Math.max(2, Math.ceil(maxScore * 0.6));

  // Emit qualifying sentences, merging adjacent ones into a single span.
  const ranges: Highlight[] = [];
  for (const { sentence, score } of scored) {
    if (score < threshold) {
      continue;
    }

    const previous = ranges.at(-1);
    if (previous && sentence.start - previous.end <= 2) {
      previous.end = sentence.end;
      previous.term = text.slice(previous.start, previous.end);
    } else {
      ranges.push({ term: sentence.text, start: sentence.start, end: sentence.end });
    }
  }

  return ranges;
}
