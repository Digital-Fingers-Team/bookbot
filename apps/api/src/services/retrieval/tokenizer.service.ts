import { normalizeText } from "../../utils/text.js";

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "was",
  "were",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with"
]);

export function tokenizeQuery(question: string) {
  const tokens = normalizeText(question)
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .map(normalizeQueryToken)
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));

  return Array.from(new Set(tokens));
}

function normalizeQueryToken(token: string) {
  if (/^exper/i.test(token)) {
    return "experience";
  }

  if (/^full.?stack$/i.test(token) || token === "fullstack") {
    return "fullstack";
  }

  return token;
}
