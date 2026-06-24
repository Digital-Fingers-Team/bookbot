import {
  BaseOpenedDocument,
  BasePageExtractor,
} from "./base.extractor.js";

import { PdfJsRenderer } from "../renderers/pdfjs.renderer.js";
import { ocrImage } from "../../ocr/ocr.service.js";
import { cleanExtractedText } from "../../../utils/text.js";

import type { ExtractedPage, OpenedDocument } from "./extractor.js";
import type { OpenedRenderer } from "../renderers/renderer.js";

class OcrDocument extends BaseOpenedDocument {
  // Rasterizing runs on a single pdfjs document, which is not safe to drive
  // concurrently, so renders are chained. The slow part — the vision call — is
  // left free to overlap across pages.
  private renderChain: Promise<unknown> = Promise.resolve();

  constructor(private readonly renderer: OpenedRenderer) {
    super();
  }

  get pageCount(): number {
    return this.renderer.pageCount;
  }

  async extractPage(pageNumber: number): Promise<ExtractedPage> {
    const rendered = await this.renderExclusive(pageNumber);
    const text = await ocrImage(rendered.image, rendered.mimeType);

    return { pageNumber, text: cleanExtractedText(text) };
  }

  private renderExclusive(pageNumber: number) {
    const run = this.renderChain.then(() => this.renderer.renderPage(pageNumber));
    this.renderChain = run.catch(() => undefined);
    return run;
  }

  async close(): Promise<void> {
    await this.renderer.close?.();
  }
}

export class OcrExtractor extends BasePageExtractor {
  readonly name = "ocr-openrouter";

  private readonly renderer = new PdfJsRenderer();

  async open(buffer: Buffer): Promise<OpenedDocument> {
    const opened = await this.renderer.open(buffer);

    return new OcrDocument(opened);
  }
}
