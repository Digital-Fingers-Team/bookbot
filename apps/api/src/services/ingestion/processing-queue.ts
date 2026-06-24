import { env } from "../../config/env.js";
import { createLimiter } from "../../utils/concurrency.js";
import { processBook } from "./ingestion.service.js";

// Up to PROCESSING_CONCURRENCY books are processed at once. Each book may fan out
// to several OCR calls, but those are bounded globally by the OCR limiter, so the
// provider/CPU stays protected regardless of how many books run in parallel.
const bookLimit = createLimiter(env.PROCESSING_CONCURRENCY);

export function enqueueBookProcessing(bookId: string): void {
  void bookLimit(() => processBook(bookId)).catch((error) => {
    console.error(`[ingestion] queued processing crashed for ${bookId}:`, error);
  });
}
