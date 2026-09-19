import { createHash } from "node:crypto";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { PDFDocument } from "pdf-lib";

import { Book } from "../../models/book.model.js";
import { Chunk } from "../../models/chunk.model.js";
import { BookPage } from "../../models/book-page.model.js";
import { storage } from "../storage/storage.service.js";
import { PdfJsRenderer } from "./renderers/pdfjs.renderer.js";

export const COVER_IMAGE_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp"
};

export const COVER_PDF_MIME = "application/pdf";

/** Front and back are stored as PNG regardless of what was uploaded. */
const HALF_MIME = "image/png";

/**
 * Scale the cover PDF is rasterized at. A cover is display art rather than
 * something to read text off, so this sits above the OCR render scale.
 */
const COVER_PDF_RENDER_SCALE = 3;

export type CoverInput = {
  buffer: Buffer;
  originalFileName: string;
  mimeType: string;
};

export type CoverHalves = { front: Buffer; back: Buffer };

export function isCoverImage(fileName: string, mimeType: string) {
  const normalized = (mimeType.toLowerCase().split(";")[0] ?? "").trim();
  return Boolean(COVER_IMAGE_TYPES[normalized]) || /\.(png|jpe?g|webp)$/i.test(fileName);
}

export function isCoverPdf(fileName: string, mimeType: string) {
  const normalized = (mimeType.toLowerCase().split(";")[0] ?? "").trim();
  return normalized === COVER_PDF_MIME || /\.pdf$/i.test(fileName);
}

/** Every file the cover upload accepts: a flat image spread, or a PDF. */
export function isCoverUpload(fileName: string, mimeType: string) {
  return isCoverImage(fileName, mimeType) || isCoverPdf(fileName, mimeType);
}

/**
 * Split an uploaded cover spread into its two faces.
 *
 * Arado supplies one wide image holding both faces of the printed cover, laid
 * out the way the flat sheet is printed: the front (الوش) on the LEFT half and
 * the back (الضهر) on the RIGHT half. Odd widths give the extra column to the
 * front, which is the half readers actually look at.
 */
export async function splitCoverSpread(buffer: Buffer): Promise<CoverHalves> {
  const image = await loadImage(buffer);
  const width = image.width;
  const height = image.height;
  if (!width || !height) {
    throw new Error("The cover image could not be read.");
  }

  const frontWidth = Math.ceil(width / 2);
  const backWidth = width - frontWidth;
  if (backWidth < 1) {
    throw new Error("The cover image is too narrow to hold both faces.");
  }

  return {
    front: cropToPng(image, 0, frontWidth, height),
    back: cropToPng(image, frontWidth, backWidth, height)
  };
}

/**
 * Read the two cover faces out of a PDF.
 *
 * A single-page PDF holds the same flat spread the image path expects, so it is
 * rasterized and split down the middle. A PDF with more pages carries the faces
 * as separate pages the way a print shop usually exports them - front first,
 * back second - and any page after those two is ignored.
 */
export async function coverHalvesFromPdf(buffer: Buffer): Promise<CoverHalves> {
  const opened = await new PdfJsRenderer().open(buffer);
  try {
    if (!opened.pageCount) {
      throw new Error("The cover PDF has no pages.");
    }
    const front = await opened.renderPage(1, COVER_PDF_RENDER_SCALE);
    if (opened.pageCount === 1) {
      return splitCoverSpread(front.image);
    }
    const back = await opened.renderPage(2, COVER_PDF_RENDER_SCALE);
    return { front: front.image, back: back.image };
  } finally {
    await opened.close?.();
  }
}

/** Resolve an uploaded cover - image spread or PDF - to its two faces. */
export async function coverHalvesFromInput(input: CoverInput): Promise<CoverHalves> {
  return isCoverPdf(input.originalFileName, input.mimeType)
    ? coverHalvesFromPdf(input.buffer)
    : splitCoverSpread(input.buffer);
}

function cropToPng(image: Awaited<ReturnType<typeof loadImage>>, sourceX: number, cropWidth: number, height: number) {
  const canvas = createCanvas(cropWidth, height);
  canvas.getContext("2d").drawImage(image, sourceX, 0, cropWidth, height, 0, 0, cropWidth, height);
  return canvas.toBuffer("image/png");
}

/**
 * Put the two cover faces into the PDF itself: the front becomes page 1 and the
 * back becomes the last page, so they show up inside the Heyzine reader, which
 * only ever sees the stored file. Each face is drawn on a page matching the
 * book`s own trim size so the flipbook keeps one consistent page shape.
 */
export async function applyCoverToPdf(pdfBuffer: Buffer, halves: CoverHalves): Promise<Buffer> {
  const pdf = await PDFDocument.load(pdfBuffer);
  const [firstPage] = pdf.getPages();
  const { width, height } = firstPage ? firstPage.getSize() : { width: 595, height: 842 };

  const front = await pdf.embedPng(halves.front);
  const back = await pdf.embedPng(halves.back);

  const frontPage = pdf.insertPage(0, [width, height]);
  frontPage.drawImage(front, coverRect(front.width, front.height, width, height));

  const backPage = pdf.addPage([width, height]);
  backPage.drawImage(back, coverRect(back.width, back.height, width, height));

  return Buffer.from(await pdf.save());
}

/** Contain-fit the face on the page and centre it, so nothing is cropped. */
function coverRect(imageWidth: number, imageHeight: number, pageWidth: number, pageHeight: number) {
  const scale = Math.min(pageWidth / imageWidth, pageHeight / imageHeight);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  return {
    x: (pageWidth - drawWidth) / 2,
    y: (pageHeight - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight
  };
}

/** Drop the cover pages a previous attach added, so a re-upload never stacks them. */
export async function stripCoverPagesFromPdf(pdfBuffer: Buffer): Promise<Buffer> {
  const pdf = await PDFDocument.load(pdfBuffer);
  const pageCount = pdf.getPageCount();
  if (pageCount <= 2) {
    return pdfBuffer;
  }
  pdf.removePage(pageCount - 1);
  pdf.removePage(0);
  return Buffer.from(await pdf.save());
}

type StoredHalves = { coverFrontPath: string; coverBackPath: string };

/** Persist both faces and return their storage keys. */
export async function storeCoverHalves(bookId: string, halves: CoverHalves): Promise<StoredHalves> {
  const checksum = createHash("sha256").update(halves.front).update(halves.back).digest("hex").slice(0, 16);
  const coverFrontPath = `covers/${bookId}-${checksum}-front.png`;
  const coverBackPath = `covers/${bookId}-${checksum}-back.png`;
  await storage.put(coverFrontPath, halves.front, HALF_MIME);
  await storage.put(coverBackPath, halves.back, HALF_MIME);
  return { coverFrontPath, coverBackPath };
}

/**
 * Attach a cover spread to a book that already exists.
 *
 * The two faces are stored on their own (the front is what the library and the
 * showcase render) and are also written into the PDF. Embedding a front page
 * shifts every existing page number by one, so the first attach moves the
 * already-extracted chunks, pages and reading positions along with it. A
 * replacement swaps the existing cover pages in place and shifts nothing.
 */
export async function attachCover(bookId: string, input: CoverInput) {
  const book = await Book.findById(bookId, {
    originalPdfPath: 1,
    sourceFormat: 1,
    pageCount: 1,
    coverFrontPath: 1,
    coverBackPath: 1,
    coverPagesInPdf: 1
  });
  if (!book) return null;
  if ((book.sourceFormat ?? "pdf") !== "pdf") {
    throw new Error("Covers can only be attached to PDF books.");
  }
  if (!book.originalPdfPath) {
    throw new Error("This book has no stored PDF to attach a cover to.");
  }

  const halves = await coverHalvesFromInput(input);
  const previousFront = book.coverFrontPath;
  const previousBack = book.coverBackPath;
  const alreadyEmbedded = book.coverPagesInPdf === true;

  const source = await storage.get(book.originalPdfPath);
  const base = alreadyEmbedded ? await stripCoverPagesFromPdf(source) : source;
  const withCover = await applyCoverToPdf(base, halves);
  await storage.put(book.originalPdfPath, withCover, "application/pdf");

  const stored = await storeCoverHalves(bookId, halves);
  const uploadedAt = new Date();

  await Book.updateOne(
    { _id: bookId },
    {
      $set: {
        ...stored,
        coverFileName: input.originalFileName,
        coverMimeType: normalizeCoverMime(input.mimeType, input.originalFileName),
        coverSize: input.buffer.length,
        coverUploadedAt: uploadedAt,
        coverPagesInPdf: true,
        ...(alreadyEmbedded ? {} : { pageCount: (book.pageCount ?? 0) + 2 })
      }
    }
  );

  // Only the first attach changes where the book`s text sits.
  if (!alreadyEmbedded) {
    await shiftPageReferences(bookId, 1);
  }

  for (const key of [previousFront, previousBack]) {
    if (key && key !== stored.coverFrontPath && key !== stored.coverBackPath) {
      await storage.delete(key);
    }
  }

  return coverMeta({ coverFileName: input.originalFileName, coverMimeType: input.mimeType, coverSize: input.buffer.length, coverUploadedAt: uploadedAt });
}

/** Remove a cover: take its pages back out of the PDF and undo the page shift. */
export async function removeCover(bookId: string) {
  const book = await Book.findById(bookId, {
    originalPdfPath: 1,
    pageCount: 1,
    coverFrontPath: 1,
    coverBackPath: 1,
    coverPagesInPdf: 1
  });
  if (!book) return false;
  if (!book.coverFrontPath && !book.coverPagesInPdf) return false;

  const wasEmbedded = book.coverPagesInPdf === true;
  if (wasEmbedded && book.originalPdfPath) {
    const source = await storage.get(book.originalPdfPath);
    await storage.put(book.originalPdfPath, await stripCoverPagesFromPdf(source), "application/pdf");
  }

  for (const key of [book.coverFrontPath, book.coverBackPath]) {
    if (key) await storage.delete(key);
  }

  await Book.updateOne(
    { _id: bookId },
    {
      $unset: {
        coverFrontPath: 1,
        coverBackPath: 1,
        coverFileName: 1,
        coverMimeType: 1,
        coverSize: 1,
        coverUploadedAt: 1,
        coverPagesInPdf: 1
      },
      ...(wasEmbedded ? { $set: { pageCount: Math.max(0, (book.pageCount ?? 0) - 2) } } : {})
    }
  );

  if (wasEmbedded) {
    await shiftPageReferences(bookId, -1);
  }

  return true;
}

/** Move every stored page reference for a book by `delta` pages. */
async function shiftPageReferences(bookId: string, delta: number) {
  if (!delta) return;
  await Chunk.updateMany({ bookId }, { $inc: { pageNumber: delta } });
  // BookPage is only populated for non-PDF books, but keep it consistent.
  await BookPage.updateMany({ bookId }, { $inc: { pageNumber: delta } });
}

export function coverMeta(book: {
  coverFileName?: string | null;
  coverMimeType?: string | null;
  coverSize?: number | null;
  coverUploadedAt?: Date | null;
} | null | undefined) {
  if (!book?.coverFileName) return null;
  return {
    fileName: book.coverFileName,
    mimeType: book.coverMimeType ?? "image/png",
    size: book.coverSize ?? 0,
    uploadedAt: book.coverUploadedAt ?? null
  };
}

function normalizeCoverMime(mimeType: string, fileName: string) {
  const normalized = (mimeType.toLowerCase().split(";")[0] ?? "").trim();
  if (COVER_IMAGE_TYPES[normalized]) return normalized;
  if (normalized === COVER_PDF_MIME) return COVER_PDF_MIME;
  const extension = fileName.toLowerCase().match(/\.(png|jpe?g|webp|pdf)$/)?.[1];
  if (!extension) return "application/octet-stream";
  if (extension === "pdf") return COVER_PDF_MIME;
  return extension.startsWith("jp") ? "image/jpeg" : `image/${extension}`;
}
