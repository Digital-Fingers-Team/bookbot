import type { Highlight } from "../../types/rag.js";
import { escapeRegExp } from "../../utils/text.js";

export function buildHighlights(text: string, keywords: string[], maxHighlights = 24): Highlight[] {
  const highlights: Highlight[] = [];

  for (const keyword of keywords) {
    if (!keyword) {
      continue;
    }

    const pattern = new RegExp(escapeRegExp(keyword), "gi");
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) && highlights.length < maxHighlights) {
      highlights.push({
        term: match[0],
        start: match.index,
        end: match.index + match[0].length
      });
    }
  }

  return highlights.sort((a, b) => a.start - b.start);
}
