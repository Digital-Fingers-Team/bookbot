import mammoth from "mammoth";

import { BaseOpenedDocument, BasePageExtractor } from "./base.extractor.js";

import { cleanExtractedText } from "../../../utils/text.js";
import { paginate } from "./paginate.js";

import type { ExtractedPage, OpenedDocument } from "./extractor.js";

class DocxDocument extends BaseOpenedDocument {
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
      text: cleanExtractedText(this.pages[pageNumber - 1] ?? "")
    };
  }
}

export class DocxExtractor extends BasePageExtractor {
  readonly name = "mammoth";

  async open(buffer: Buffer): Promise<OpenedDocument> {
    const result = await mammoth.extractRawText({ buffer });
    const pages = paginate(result.value);

    if (!pages.length) {
      throw new Error("This document does not contain readable text.");
    }

    return new DocxDocument(pages);
  }
}
