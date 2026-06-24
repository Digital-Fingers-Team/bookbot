import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

import {
  BaseOpenedDocument,
  BasePageExtractor,
} from "./base.extractor.js";

import { cleanExtractedText } from "../../../utils/text.js";

import type { ExtractedPage } from "./extractor.js";

type PositionedRun = {
  str: string;
  x: number;
  y: number;
};

// True when a line is dominated by a right-to-left script (Arabic/Hebrew).
function isRightToLeft(text: string): boolean {
  const rtl = (text.match(/[\u0590-\u05ff\u0600-\u06ff\u0750-\u077f\ufb50-\ufdff\ufe70-\ufeff]/g) ?? []).length;
  const ltr = (text.match(/[A-Za-z]/g) ?? []).length;
  return rtl > ltr;
}

function rebuildText(items: any[]): string {
  const runs: PositionedRun[] = items
    .map((item) => ({
      str: typeof item.str === "string" ? item.str : "",
      x: item.transform?.[4] ?? 0,
      y: item.transform?.[5] ?? 0,
    }))
    .filter((run) => run.str.length > 0)
    .sort((a, b) => b.y - a.y);

  // Group runs that share a baseline into visual lines.
  const lines: PositionedRun[][] = [];
  for (const run of runs) {
    const current = lines.at(-1);
    const lineY = current?.[0]?.y;

    if (current && lineY !== undefined && Math.abs(lineY - run.y) <= 4) {
      current.push(run);
    } else {
      lines.push([run]);
    }
  }

  const rendered = lines.map((line) => {
    // Order runs left-to-right by their x position (visual order).
    const visual = [...line].sort((a, b) => a.x - b.x);
    const visualText = visual.map((run) => run.str).join(" ");

    // pdf.js returns RTL text in visual order, so the logical reading order is
    // the reverse. Flipping the run order restores correct Arabic word order.
    if (isRightToLeft(visualText)) {
      return [...visual].reverse().map((run) => run.str).join(" ");
    }

    return visualText;
  });

  return cleanExtractedText(rendered.join("\n"));
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
    // In pdfjs v6 the document is torn down through its loading task; the proxy
    // itself no longer exposes `destroy()`.
    await this.document.loadingTask.destroy();
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