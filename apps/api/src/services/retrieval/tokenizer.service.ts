import { normalizeText, isArabicText } from "../../utils/text.js";

const ENGLISH_STOPWORDS = new Set([
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

const ARABIC_STOPWORDS = new Set([
  "في",
  "من",
  "إلى",
  "هو",
  "هي",
  "أن",
  "على",
  "هذا",
  "هذه",
  "ذلك",
  "تلك",
  "التي",
  "الذي",
  "و",
  "أو",
  "لا",
  "بل",
  "لم",
  "قد",
  "كان",
  "كانت",
  "ليس",
  "ليست",
  "عن",
  "مع",
  "بعد",
  "قبل",
  "أمام",
  "تحت",
  "فوق",
  "بين",
  "حول",
  "ضد",
  "أم"
]);

export function tokenizeQuery(question: string) {
  const isArabic = isArabicText(question);
  const stopwords = isArabic ? ARABIC_STOPWORDS : ENGLISH_STOPWORDS;
  
  const tokens = normalizeText(question)
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .map((token) => normalizeQueryToken(token, isArabic))
    .filter((token) => token.length >= 2 && !stopwords.has(token));

  return Array.from(new Set(tokens));
}

function normalizeQueryToken(token: string, isArabic: boolean) {
  if (isArabic) {
    return token;
  }
  
  if (/^exper/i.test(token)) {
    return "experience";
  }

  if (/^full.?stack$/i.test(token) || token === "fullstack") {
    return "fullstack";
  }

  return token;
}
