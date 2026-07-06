export type TextQualityResult = {
  score: number;
  reasons: string[];
};

const ARABIC = /[؀-ۿ]/g;
const LATIN = /[A-Za-z]/g;

// Scripts that have no business appearing in an Arabic/English book. OCR and
// broken font decoders occasionally guess Cyrillic/Greek/CJK glyphs for
// unrecognized shapes; a handful of these is a strong garble signal even when
// none of the other heuristics fire.
const UNEXPECTED_SCRIPT = /[Ѐ-ӿͰ-Ͽ一-鿿぀-ヿ가-힯]/g;

/**
 * Score how trustworthy an extracted page of text is (0-100). A low score means
 * the text layer is corrupt or missing and the page should be sent to OCR.
 *
 * The signals are tuned for the failure modes seen in real Arabic PDFs with
 * broken embedded-font encodings:
 *  - kashida / elongation decoded as repeated identical letters ("اسكككككتخدام")
 *  - reversed, letter-spaced runs where every token is a single glyph
 *    ("ا م ا م ت ه ا د ي ا ز ت")
 *  - replacement characters from failed glyph decoding
 *  - near-empty pages (scanned images with no real text layer)
 */
export function evaluateTextQuality(text: string): TextQualityResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { score: 0, reasons: ["empty"] };
  }

  const reasons: string[] = [];
  let score = 100;

  const words = trimmed.split(/\s+/);

  // Replacement glyphs: the decoder could not map the font at all.
  const replacementChars = (text.match(/�/g) ?? []).length;
  if (replacementChars > 0) {
    score -= 40;
    reasons.push("replacement-characters");
  }

  // Boxes / unknown symbols.
  if (/[□■◼◻◆◇◊¤]/.test(text)) {
    score -= 20;
    reasons.push("unknown-symbols");
  }

  // Cyrillic/Greek/CJK glyphs mixed into Arabic/English prose: near-certain
  // misreads, not legitimate content.
  const unexpectedScriptChars = (text.match(UNEXPECTED_SCRIPT) ?? []).length;
  if (unexpectedScriptChars > 0) {
    score -= Math.min(60, unexpectedScriptChars * 15);
    reasons.push("unexpected-script");
  }

  // Repeated identical letters (>=3 in a row). Arabic words essentially never
  // contain three identical consecutive letters, so these are kashida/elongation
  // artifacts. Each occurrence is a strong corruption signal.
  const repeatedRuns = (text.match(/(\p{L})\1{2,}/gu) ?? []).length;
  if (repeatedRuns > 0) {
    score -= Math.min(60, repeatedRuns * 12);
    reasons.push("repeated-letters");
  }

  // Scattered single letters: visual-order extraction often emits each glyph as
  // its own space-separated token in reverse order.
  const singleLetterTokens = words.filter((word) => word.length === 1 && /\p{L}/u.test(word)).length;
  const singleRatio = singleLetterTokens / words.length;
  if (words.length >= 8 && singleRatio > 0.25) {
    score -= Math.min(60, Math.round(singleRatio * 80));
    reasons.push("scattered-letters");
  }

  // Very little text usually means a scanned/image-only page.
  if (words.length < 12) {
    score -= 45;
    reasons.push("too-few-words");
  }

  // Mostly non-letter noise (e.g. leader dots, symbols).
  const letters = (text.match(ARABIC) ?? []).length + (text.match(LATIN) ?? []).length;
  const nonSpace = trimmed.replace(/\s/g, "").length;
  if (nonSpace > 0 && letters < nonSpace * 0.5) {
    score -= 20;
    reasons.push("low-language-density");
  }

  score = Math.max(0, Math.min(100, score));
  return { score, reasons };
}
