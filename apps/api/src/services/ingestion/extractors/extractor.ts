import type { PageText } from "../chunker.service.js";

export type ExtractedPage = PageText;

export interface OpenedDocument {
  readonly pageCount: number;

  extractPage(pageNumber: number): Promise<ExtractedPage>;

  close?(): Promise<void>;
}

export interface PageExtractor {
  /**
   * Unique extractor name.
   * Examples:
   * pdfjs
   * mupdf
   * ocr
   * azure
   */
  readonly name: string;

  /**
   * Opens a document once.
   * The returned object is reused for every page.
   */
  open(buffer: Buffer): Promise<OpenedDocument>;
}