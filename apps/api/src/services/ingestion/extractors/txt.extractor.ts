import { BaseOpenedDocument, BasePageExtractor } from "./base.extractor.js";

import { cleanExtractedText } from "../../../utils/text.js";
import { paginate } from "./paginate.js";

import type { ExtractedPage, OpenedDocument } from "./extractor.js";

class TxtDocument extends BaseOpenedDocument {
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

export class TxtExtractor extends BasePageExtractor {
  readonly name = "txt";

  async open(buffer: Buffer): Promise<OpenedDocument> {
    const text = buffer.toString("utf-8");
    const pages = paginate(text);

    if (!pages.length) {
      throw new Error("This text file does not contain readable text.");
    }

    return new TxtDocument(pages);
  }
}
