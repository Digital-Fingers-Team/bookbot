export type TextQualityResult = {
  score: number;
  reasons: string[];
};

export function evaluateTextQuality(text: string): TextQualityResult {
  const reasons: string[] = [];

  if (!text.trim()) {
    return {
      score: 0,
      reasons: ["empty"]
    };
  }

  let score = 100;

  const words = text.trim().split(/\s+/);

  if (words.length < 20) {
    score -= 40;
    reasons.push("too-few-words");
  }

  const replacementChars =
    (text.match(/�/g) ?? []).length +
    (text.match(/\uFFFD/g) ?? []).length;

  if (replacementChars > 0) {
    score -= 40;
    reasons.push("replacement-characters");
  }

  const weirdChars =
    (text.match(/[□■◼◻◆◇◊¤]/g) ?? []).length;

  if (weirdChars > 0) {
    score -= 20;
    reasons.push("unknown-symbols");
  }

  const repeatedRuns =
    (text.match(/(.)\1{5,}/g) ?? []).length;

  if (repeatedRuns > 0) {
    score -= repeatedRuns * 15;
    reasons.push("repeated-characters");
  }

  const arabic =
    (text.match(/[\u0600-\u06FF]/g) ?? []).length;

  const latin =
    (text.match(/[A-Za-z]/g) ?? []).length;

  if (arabic + latin < words.length * 2) {
    score -= 15;
    reasons.push("low-language-density");
  }

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    reasons
  };
}

export function isGoodExtraction(score: number) {
  return score >= 70;
}