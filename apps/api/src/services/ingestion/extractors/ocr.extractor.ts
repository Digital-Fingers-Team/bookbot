import {
  BaseOpenedDocument,
  BasePageExtractor,
} from "./base.extractor.js";

import type {
  ExtractedPage,
} from "./extractor.js";

class OcrDocument extends BaseOpenedDocument {

  readonly pageCount: number;

  constructor(
    pageCount: number
  ) {
    super();
    this.pageCount = pageCount;
  }

  async extractPage(
    pageNumber: number
  ): Promise<ExtractedPage> {

    throw new Error(
      `OCR extraction is not implemented yet (page ${pageNumber}).`
    );

  }

}

export class OcrExtractor
  extends BasePageExtractor {

  readonly name = "ocr";

  async open(
    _buffer: Buffer
  ): Promise<OcrDocument> {

    throw new Error(
      "OCR extractor is not configured."
    );

  }

}