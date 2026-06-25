export function cleanWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function cleanCorruptedText(value: string): string {
  // Remove repeated Arabic characters: "الإسااالام" -> "الإسلام"
  let result = value.replace(/([ا-ي])\1{2,}/g, "$1");
  
  // Fix space-separated single characters at end of words
  result = result.replace(/([ا-ي])\s+([ا-ي])\s+([ا-ي])\s+([ا-ي])(?=\s|$)/g, "$1$2$3$4");
  
  // Remove excessive spaces
  result = result.replace(/\s{2,}/g, " ");
  
  return result.trim();
}

export function isArabicText(value: string): boolean {
  return /[\u0600-\u06FF]/.test(value);
}

// Invisible formatting and bidirectional control marks that PDFs frequently
// embed. They make stored text look corrupted and silently break search
// matching, so they are removed from both display and search text.
const INVISIBLE_MARKS = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;

/**
 * Turn a raw PDF text extraction into clean, human-readable text suitable for
 * storage and display.
 *
 * The key step is `NFKC` normalization. Arabic PDFs commonly encode glyphs as
 * Unicode "presentation forms" (U+FB50-U+FDFF, U+FE70-U+FEFF) and ligatures,
 * which render in a different font and are awkward to store and search. NFKC
 * maps those back to standard Arabic letters. Diacritics and letter case are
 * intentionally preserved so the displayed evidence stays faithful to the book.
 *
 * Note: this does NOT remove the U+FFFD replacement character or long repeated
 * runs, because the quality scorer relies on those signals to fall back to a
 * different extractor.
 */
export function cleanExtractedText(value: string): string {
  if (!value) {
    return "";
  }

  let result = value.normalize("NFKC");
  result = result.replace(INVISIBLE_MARKS, "");
  result = result.replace(/\u0640/g, ""); // tatweel (kashida) is decorative

  // Normalize spacing while keeping paragraph breaks.
  result = result.replace(/[^\S\n]+/g, " ");
  result = result.replace(/ *\n */g, "\n");
  result = result.replace(/\n{3,}/g, "\n\n");

  return result.trim();
}

export function normalizeText(value: string) {
  const cleaned = cleanWhitespace(value);
  
  if (isArabicText(cleaned)) {
    return normalizeArabicText(cleaned);
  }
  
  return cleaned
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeArabicText(value: string): string {
  return cleanWhitespace(value)
    .normalize("NFKD")
    .replace(/[\u064b-\u0652]/g, "")
    .replace(/[\u0640]/g, "");
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Strong "this is a contents/index page" keywords (matched on diacritic-stripped text).
const TOC_KEYWORDS = /فهرس|المحتويات|جدول المحتويات|قائمة المحتويات|table of contents/;
// Section/ordinal markers common in Arabic academic front-matter, matched as
// whole words so they don't fire inside unrelated words.
const TOC_SECTION_MARKERS =
  /(?<![\p{L}])(?:المبحث|الفصل|المطلب|الباب|تمهيد|مقدمة|مقدمه|الخاتمة|الخاتمه|المراجع|اولا|ثانيا|ثالثا|رابعا|خامسا|سادسا|سابعا)(?![\p{L}])/gu;
// Dotted leaders ("title .......... 12") that almost only appear in a contents list.
const DOTTED_LEADERS = /[.…·•]{4,}|(?:\.\s?){4,}/g;
const DIGITS = /[\d٠-٩۰-۹]/g;

/**
 * Heuristic detector for table-of-contents / index (فهرس) pages so they can be
 * dropped from retrieval — they are full of section titles + page numbers and
 * never actually answer a question, yet match many queries on keywords alone.
 * Tuned for precision (avoid flagging real prose) by requiring several signals.
 */
export function isLikelyTableOfContents(value: string): boolean {
  const text = value.trim();
  if (text.length < 12) {
    return false;
  }

  const normalized = text.normalize("NFKD").replace(/\p{M}/gu, "");
  // A page that literally says "contents" / فهرس is a contents page regardless of length.
  if (TOC_KEYWORDS.test(normalized)) {
    return true;
  }

  // The remaining signals need enough text to be meaningful.
  if (text.length < 40) {
    return false;
  }

  const dottedLeaders = (text.match(DOTTED_LEADERS) ?? []).length;
  const sectionMarkers = (normalized.match(TOC_SECTION_MARKERS) ?? []).length;
  const digitCount = (text.match(DIGITS) ?? []).length;
  const letterCount = (text.match(/\p{L}/gu) ?? []).length;
  const digitRatio = digitCount + letterCount ? digitCount / (digitCount + letterCount) : 0;

  if (dottedLeaders >= 2) {
    return true;
  }
  if (sectionMarkers >= 4) {
    return true;
  }
  if (sectionMarkers >= 2 && (dottedLeaders >= 1 || digitRatio > 0.12)) {
    return true;
  }
  if (digitRatio > 0.22 && sectionMarkers >= 1) {
    return true;
  }

  return false;
}

export function excerpt(value: string, maxLength = 420) {
  const text = cleanWhitespace(value);
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3).trim()}...`;
}

/**
 * Pick the most relevant window of a chunk for display as "supporting text".
 *
 * Instead of always showing the opening of a chunk (which is often a heading or
 * a contents list), this centres the snippet on the densest cluster of query
 * matches — the `ranges` are the highlight offsets the reranker already found
 * for the question's terms. Falls back to the chunk's start when nothing matched.
 */
export function bestSnippet(value: string, ranges: Array<{ start: number; end: number }> = [], maxLength = 360): string {
  if (value.length <= maxLength) {
    return cleanWhitespace(value);
  }

  const points = ranges
    .map((range) => range.start)
    .filter((start) => start >= 0 && start < value.length)
    .sort((a, b) => a - b);

  const firstPoint = points[0];
  if (firstPoint === undefined) {
    return excerpt(value, maxLength);
  }

  // Find the anchor whose following `maxLength` window covers the most matches.
  let bestAnchor = firstPoint;
  let bestCount = 0;
  for (const anchor of points) {
    const windowEnd = anchor + maxLength;
    let count = 0;
    for (const point of points) {
      if (point >= anchor && point < windowEnd) {
        count += 1;
      }
    }
    if (count > bestCount) {
      bestCount = count;
      bestAnchor = anchor;
    }
  }

  // Give the first match a little lead-in, then clamp the window to the text.
  let start = Math.max(0, bestAnchor - 60);
  let end = Math.min(value.length, start + maxLength);
  start = Math.max(0, end - maxLength);

  // Snap to word boundaries so we don't slice words in half.
  if (start > 0) {
    const nextSpace = value.indexOf(" ", start);
    if (nextSpace !== -1 && nextSpace - start < 40) {
      start = nextSpace + 1;
    }
  }
  if (end < value.length) {
    const prevSpace = value.lastIndexOf(" ", end);
    if (prevSpace > start) {
      end = prevSpace;
    }
  }

  let snippet = cleanWhitespace(value.slice(start, end));
  if (start > 0) {
    snippet = `…${snippet}`;
  }
  if (end < value.length) {
    snippet = `${snippet}…`;
  }
  return snippet;
}
