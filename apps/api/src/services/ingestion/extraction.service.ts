import type { PageText } from "./chunker.service.js";

import { evaluateTextQuality } from "./text-quality.service.js";

import { PdfJsExtractor } from "./extractors/pdfjs.extractor.js";
import { FallbackExtractor } from "./extractors/fallback.extractor.js";

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

export async function extractBook(
  buffer: Buffer
): Promise<ExtractionResult> {

  const pdfExtractor = new PdfJsExtractor();
  const fallbackExtractor = new FallbackExtractor();

  const pdf = await pdfExtractor.open(buffer);
  const fallback = await fallbackExtractor.open(buffer);

  const pages: ExtractionPage[] = [];

  try {

    const pageCount = Math.max(
      pdf.pageCount,
      fallback.pageCount
    );

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {

      let selectedPage: PageText | undefined;
      let selectedExtractor = "";
      let selectedScore = -1;
      let selectedReasons: string[] = [];

      try {

        if (pageNumber <= pdf.pageCount) {

          const page = await pdf.extractPage(pageNumber);

          const quality = evaluateTextQuality(page.text);

          selectedPage = page;
          selectedExtractor = pdfExtractor.name;
          selectedScore = quality.score;
          selectedReasons = quality.reasons;

        }

      } catch {}

      try {

        if (
          pageNumber <= fallback.pageCount &&
          selectedScore < 70
        ) {

          const page = await fallback.extractPage(pageNumber);

          const quality = evaluateTextQuality(page.text);

          if (quality.score > selectedScore) {

            selectedPage = page;
            selectedExtractor = fallbackExtractor.name;
            selectedScore = quality.score;
            selectedReasons = quality.reasons;

          }

        }

      } catch {}

      if (!selectedPage) {

        throw new Error(
          `Unable to extract page ${pageNumber}.`
        );

      }

      console.log(
        `[Page ${pageNumber}] ${selectedExtractor} (${selectedScore})`
      );

      pages.push({
        page: selectedPage,
        extractor: selectedExtractor,
        qualityScore: selectedScore,
        qualityReasons: selectedReasons,
      });

    }

    return {
      pages,
      pageCount,
    };

  } finally {

    await pdf.close?.();
    await fallback.close?.();

  }

}