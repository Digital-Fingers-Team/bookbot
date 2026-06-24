import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas, DOMMatrix, Path2D } from "@napi-rs/canvas";

import { env } from "../../../config/env.js";

import type { OpenedRenderer, PageRenderer, RenderedPage } from "./renderer.js";

// pdfjs reaches for these browser globals while rasterizing under Node.
const globalScope = globalThis as Record<string, unknown>;
globalScope.DOMMatrix ??= DOMMatrix;
globalScope.Path2D ??= Path2D;

const require = createRequire(import.meta.url);
const pdfjsRoot = require.resolve("pdfjs-dist/package.json").replace(/package\.json$/, "");
const STANDARD_FONT_URL = pathToFileURL(pdfjsRoot + "standard_fonts/").href;

class PdfJsOpenedRenderer implements OpenedRenderer {
  constructor(private readonly document: pdfjsLib.PDFDocumentProxy) {}

  get pageCount(): number {
    return this.document.numPages;
  }

  async renderPage(pageNumber: number, scale = env.OCR_RENDER_SCALE): Promise<RenderedPage> {
    if (pageNumber < 1 || pageNumber > this.pageCount) {
      throw new RangeError(`Page ${pageNumber} does not exist.`);
    }

    const page = await this.document.getPage(pageNumber);

    try {
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext("2d");

      await page.render({
        // @napi-rs/canvas implements the same drawing API pdfjs needs.
        canvasContext: context as unknown as CanvasRenderingContext2D,
        viewport,
        canvas: canvas as unknown as HTMLCanvasElement,
      }).promise;

      return {
        pageNumber,
        image: await canvas.encode("png"),
        mimeType: "image/png",
      };
    } finally {
      page.cleanup();
    }
  }

  async close(): Promise<void> {
    await this.document.loadingTask.destroy();
  }
}

export class PdfJsRenderer implements PageRenderer {
  readonly name = "pdfjs-canvas";

  async open(buffer: Buffer): Promise<OpenedRenderer> {
    const document = await pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      standardFontDataUrl: STANDARD_FONT_URL,
    }).promise;

    return new PdfJsOpenedRenderer(document);
  }
}
