import pdfParse from "pdf-parse";
import { ApiError } from "../../utils/api-error.js";
import { cleanWhitespace } from "../../utils/text.js";
import type { PageText } from "./chunker.service.js";

type PdfPageData = {
  getTextContent: () => Promise<{ items: Array<{ str?: string }> }>;
};

export async function extractPdfPages(buffer: Buffer): Promise<{ pages: PageText[]; pageCount: number }> {
  const pages: PageText[] = [];

  try {
    const result = await pdfParse(buffer, {
      pagerender: async (pageData: PdfPageData) => {
        const content = await pageData.getTextContent();
        const text = cleanWhitespace(content.items.map((item) => item.str ?? "").join(" "));
        pages.push({ pageNumber: pages.length + 1, text });
        return text;
      }
    });

    if (!pages.length && result.text) {
      pages.push({ pageNumber: 1, text: cleanWhitespace(result.text) });
    }

    return {
      pages: pages.filter((page) => page.text.length > 0),
      pageCount: result.numpages || pages.length
    };
  } catch {
    throw new ApiError(400, "INVALID_PDF", "We could not read this PDF. Please upload a valid, text-based PDF.");
  }
}
