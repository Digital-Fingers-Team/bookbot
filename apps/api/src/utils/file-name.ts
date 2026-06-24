import { cleanWhitespace, excerpt } from "./text.js";

const MOJIBAKE_MARKERS = /[\u00C0-\u00FF]/;
const ARABIC_TEXT = /[\u0600-\u06FF]/;
const LATIN_TEXT = /[A-Za-z]/;
const DIGIT_OR_SYMBOL = /[\d!"#$%&'()*+,./:;<=>?@[\\\]^_`{|}~-]/g;

export function normalizeUploadedFileName(fileName: string) {
  const decoded = Buffer.from(fileName, "latin1").toString("utf8");

  if (decoded.includes("\uFFFD")) {
    return fileName;
  }

  if (MOJIBAKE_MARKERS.test(fileName)) {
    return decoded;
  }

  return fileName;
}

export function titleFromFileName(fileName: string) {
  return normalizeUploadedFileName(fileName).replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim() || "Untitled book";
}

export function readableBookTitle(input: { title: string; originalFileName: string; firstPageText?: string }) {
  const title = titleFromFileName(input.title);
  if (!looksCorruptedTitle(title)) {
    return title;
  }

  const originalTitle = titleFromFileName(input.originalFileName);
  if (!looksCorruptedTitle(originalTitle)) {
    return originalTitle;
  }

  const firstPageTitle = titleFromFirstPage(input.firstPageText ?? "");
  if (firstPageTitle) {
    return firstPageTitle;
  }

  return "Untitled book";
}

function looksCorruptedTitle(value: string) {
  const text = cleanWhitespace(value);
  if (!text) {
    return true;
  }

  if (text.includes("\uFFFD") || MOJIBAKE_MARKERS.test(text)) {
    return true;
  }

  if (ARABIC_TEXT.test(text)) {
    return false;
  }

  const symbolCount = text.match(DIGIT_OR_SYMBOL)?.length ?? 0;
  const symbolRatio = symbolCount / Math.max(text.length, 1);
  const hasLatin = LATIN_TEXT.test(text);
  const hasLowercaseLatin = /[a-z]/.test(text);
  return text.length >= 12 && hasLatin && !hasLowercaseLatin && symbolRatio >= 0.18;
}

function titleFromFirstPage(firstPageText: string) {
  const text = cleanWhitespace(firstPageText);
  if (!ARABIC_TEXT.test(text)) {
    return "";
  }

  return excerpt(text.split(/[.!؟،:؛]/)[0] ?? text, 90);
}
