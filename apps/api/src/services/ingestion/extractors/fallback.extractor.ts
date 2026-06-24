import pdf from "pdf-parse";

import type {
  ExtractionResult,
  PdfExtractor,
} from "./extractor.js";

export class FallbackExtractor implements PdfExtractor {
  readonly name = "pdf-parse";

  async extract(buffer: Buffer): Promise<ExtractionResult> {
    const result = await pdf(buffer);

    const pages = splitPages(result.text);

    return {
      pages,
      pageCount: pages.length,
    };
  }
}

function splitPages(text: string) {
  const normalized = text.replace(/\r/g, "");

  const parts =
    normalized.match(/\f/)
      ? normalized.split("\f")
      : normalized.split(/\n{3,}/);

  return parts
    .map((page, index) => ({
      pageNumber: index + 1,
      text: page.trim(),
    }))
    .filter((p) => p.text.length > 0);
}