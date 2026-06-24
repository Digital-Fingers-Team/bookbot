import pdf from "pdf-parse";

import {
  BaseOpenedDocument,
  BasePageExtractor,
} from "./base.extractor.js";

import { cleanExtractedText } from "../../../utils/text.js";

import type { ExtractedPage, OpenedDocument } from "./extractor.js";

class PdfParseDocument extends BaseOpenedDocument {
  constructor(private readonly pages: string[]) {
    super();
  }

  get pageCount(): number {
    return this.pages.length;
  }

  async extractPage(pageNumber: number): Promise<ExtractedPage> {
    if (pageNumber < 1 || pageNumber > this.pageCount) {
      throw new RangeError(`Page ${pageNumber} does not exist.`);
    }

    return {
      pageNumber,
      text: cleanExtractedText(this.pages[pageNumber - 1] ?? ""),
    };
  }
}

export class FallbackExtractor extends BasePageExtractor {
  readonly name = "pdf-parse";

  async open(buffer: Buffer): Promise<OpenedDocument> {
    const result = await pdf(buffer);

    return new PdfParseDocument(splitPages(result.text));
  }
}

function splitPages(text: string): string[] {
  const normalized = text.replace(/\r/g, "");

  const parts = normalized.match(/\f/)
    ? normalized.split("\f")
    : normalized.split(/\n{3,}/);

  return parts.map((page) => page.trim()).filter((page) => page.length > 0);
}
