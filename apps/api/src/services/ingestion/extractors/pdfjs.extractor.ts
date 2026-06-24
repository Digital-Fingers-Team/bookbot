import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

import {
  BaseOpenedDocument,
  BasePageExtractor,
} from "./base.extractor.js";

import type { ExtractedPage } from "./extractor.js";

function rebuildText(items: any[]): string {
  const sorted = [...items].sort((a, b) => {
    const ay = a.transform?.[5] ?? 0;
    const by = b.transform?.[5] ?? 0;

    if (Math.abs(ay - by) > 2) {
      return by - ay;
    }

    return (a.transform?.[4] ?? 0) - (b.transform?.[4] ?? 0);
  });

  const lines: string[] = [];

  let currentLine = "";
  let previousY: number | undefined;

  for (const item of sorted) {
    const y = item.transform?.[5] ?? 0;

    if (
      previousY !== undefined &&
      Math.abs(previousY - y) > 4
    ) {
      lines.push(currentLine.trim());
      currentLine = "";
    }

    currentLine += (item.str ?? "") + " ";

    previousY = y;
  }

  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }

  return lines
    .join("\n")
    .replace(/\u0640/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

class PdfJsDocument extends BaseOpenedDocument {

  constructor(
    private readonly document: pdfjsLib.PDFDocumentProxy
  ) {
    super();
  }

  get pageCount(): number {
    return this.document.numPages;
  }

  async extractPage(
    pageNumber: number
  ): Promise<ExtractedPage> {

    if (
      pageNumber < 1 ||
      pageNumber > this.pageCount
    ) {
      throw new RangeError(
        `Page ${pageNumber} does not exist.`
      );
    }

    const page =
      await this.document.getPage(pageNumber);

    const textContent =
      await page.getTextContent();

    return {
      pageNumber,
      text: rebuildText(
        textContent.items as any[]
      ),
    };
  }

  async close(): Promise<void> {
    await this.document.destroy();
  }

}

export class PdfJsExtractor
  extends BasePageExtractor {

  readonly name = "pdfjs";

  async open(
    buffer: Buffer
  ): Promise<PdfJsDocument> {

    const loadingTask =
      pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
      });

    const pdf =
      await loadingTask.promise;

    return new PdfJsDocument(pdf);
  }

}