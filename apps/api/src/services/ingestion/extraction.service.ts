import os from "node:os";

import type { PageText } from "./chunker.service.js";
import type { OpenedDocument } from "./extractors/extractor.js";

import { env } from "../../config/env.js";
import { mapWithConcurrency } from "../../utils/concurrency.js";
import { evaluateTextQuality } from "./text-quality.service.js";
import { isOcrAvailable } from "../ocr/ocr.service.js";

import { PdfJsExtractor } from "./extractors/pdfjs.extractor.js";
import { FallbackExtractor } from "./extractors/fallback.extractor.js";
import { OcrExtractor } from "./extractors/ocr.extractor.js";

// The text pass is light (CPU + a shared pdfjs worker), so a modest pool is
// plenty and avoids starving the rest of the process.
const TEXT_CONCURRENCY = Math.max(2, Math.min(8, os.cpus().length || 4));

export type ExtractionPage = {
  page: PageText;
  extractor: string;
  qualityScore: number;
  qualityReasons: string[];
};

export type ExtractionResult = {
  pages: ExtractionPage[];
  pageCount: number;
};

export type ExtractionProgress = (done: number, total: number) => void;

type Candidate = {
  text: string;
  extractor: string;
  score: number;
  reasons: string[];
};

/**
 * Extract a book page by page. Each page is read with the fast text extractors
 * (pdfjs + pdf-parse) and scored; the best candidate is kept. Pages whose text
 * layer is corrupt or empty (score below `OCR_MIN_TEXT_SCORE`) are sent to the
 * vision OCR fallback, which reads the rendered page image instead.
 */
export async function extractBook(
  buffer: Buffer,
  onProgress?: ExtractionProgress
): Promise<ExtractionResult> {
  const pdfExtractor = new PdfJsExtractor();
  const fallbackExtractor = new FallbackExtractor();

  const pdf = await openSafely(() => pdfExtractor.open(buffer));
  const fallback = await openSafely(() => fallbackExtractor.open(buffer));

  if (!pdf && !fallback) {
    throw new Error("Unable to open the PDF with any extractor.");
  }

  const pageCount = Math.max(pdf?.pageCount ?? 0, fallback?.pageCount ?? 0);
  const selected: (ExtractionPage | undefined)[] = new Array(pageCount).fill(undefined);
  const ocrTargets: number[] = [];
  const pageNumbers = Array.from({ length: pageCount }, (_, index) => index + 1);

  try {
    onProgress?.(0, pageCount);

    // Pass 1 — cheap text extraction, pick the best candidate per page. Pages
    // are independent, so they run concurrently.
    await mapWithConcurrency(pageNumbers, TEXT_CONCURRENCY, async (pageNumber) => {
      const candidates: Candidate[] = [];

      if (pdf && pageNumber <= pdf.pageCount) {
        const text = await extractSafely(pdf, pageNumber);
        if (text !== undefined) {
          candidates.push(scoreCandidate(text, pdfExtractor.name));
        }
      }

      if (fallback && pageNumber <= fallback.pageCount) {
        const text = await extractSafely(fallback, pageNumber);
        if (text !== undefined) {
          candidates.push(scoreCandidate(text, fallbackExtractor.name));
        }
      }

      const best = pickBest(candidates);
      selected[pageNumber - 1] = toExtractionPage(pageNumber, best);

      if (best.score < env.OCR_MIN_TEXT_SCORE) {
        ocrTargets.push(pageNumber);
      }
    });

    ocrTargets.sort((a, b) => a - b);

    // Pass 2 — OCR the pages the text layer could not handle.
    const targets = isOcrAvailable() ? ocrTargets.slice(0, env.OCR_MAX_PAGES) : [];

    let done = pageCount - targets.length;
    onProgress?.(done, pageCount);

    if (targets.length) {
      const ocrExtractor = new OcrExtractor();
      const ocr = await ocrExtractor.open(buffer);

      try {
        await mapWithConcurrency(targets, env.OCR_CONCURRENCY, async (pageNumber) => {
          try {
            const page = await ocr.extractPage(pageNumber);
            const candidate = scoreCandidate(page.text, ocrExtractor.name);
            const current = selected[pageNumber - 1];

            if (!current || candidate.score >= current.qualityScore) {
              selected[pageNumber - 1] = toExtractionPage(pageNumber, candidate);
            }
          } catch (error) {
            console.error(`[extraction] OCR failed for page ${pageNumber}:`, error);
          } finally {
            done += 1;
            onProgress?.(done, pageCount);
          }
        });
      } finally {
        await ocr.close?.();
      }
    }

    const pages = selected.filter((page): page is ExtractionPage => page !== undefined);
    logSummary(pages);

    return { pages, pageCount };
  } finally {
    await pdf?.close?.();
    await fallback?.close?.();
  }
}

function scoreCandidate(text: string, extractor: string): Candidate {
  const quality = evaluateTextQuality(text);
  return { text, extractor, score: quality.score, reasons: quality.reasons };
}

function pickBest(candidates: Candidate[]): Candidate {
  if (!candidates.length) {
    return { text: "", extractor: "none", score: 0, reasons: ["empty"] };
  }

  return candidates.reduce((best, candidate) => (candidate.score > best.score ? candidate : best));
}

function toExtractionPage(pageNumber: number, candidate: Candidate): ExtractionPage {
  return {
    page: { pageNumber, text: candidate.text },
    extractor: candidate.extractor,
    qualityScore: candidate.score,
    qualityReasons: candidate.reasons,
  };
}

async function openSafely(open: () => Promise<OpenedDocument>): Promise<OpenedDocument | undefined> {
  try {
    return await open();
  } catch (error) {
    console.error("[extraction] extractor failed to open:", error);
    return undefined;
  }
}

async function extractSafely(document: OpenedDocument, pageNumber: number): Promise<string | undefined> {
  try {
    const page = await document.extractPage(pageNumber);
    return page.text;
  } catch {
    return undefined;
  }
}

function logSummary(pages: ExtractionPage[]) {
  const byExtractor = new Map<string, number>();
  for (const page of pages) {
    byExtractor.set(page.extractor, (byExtractor.get(page.extractor) ?? 0) + 1);
  }

  console.log("[extraction] summary", {
    pages: pages.length,
    extractors: Object.fromEntries(byExtractor),
  });
}
