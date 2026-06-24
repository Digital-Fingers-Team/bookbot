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

export function excerpt(value: string, maxLength = 420) {
  const text = cleanWhitespace(value);
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3).trim()}...`;
}
