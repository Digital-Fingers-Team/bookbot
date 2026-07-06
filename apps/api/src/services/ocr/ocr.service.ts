import { env } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";
import { createLimiter } from "../../utils/concurrency.js";
import { evaluateTextQuality } from "../ingestion/text-quality.service.js";
import { localOcr } from "./local-ocr.service.js";
import { visionOcr } from "./vision-ocr.service.js";

// Cloud failures that should transparently fall back to local OCR.
const FALLBACK_CODES = new Set(["OCR_OUT_OF_CREDITS", "OPENROUTER_NOT_CONFIGURED"]);

// Caps total OCR in flight across every book/page being processed, so book- and
// page-level parallelism cannot overwhelm the provider (rate limits) or the CPU
// (local tesseract). This is the single global throttle for all OCR work.
const ocrLimit = createLimiter(env.OCR_CONCURRENCY);

let warnedFallback = false;

/**
 * True when OCR can run at all. Local OCR needs no API key, so OCR is available
 * unless it is disabled, or explicitly forced to OpenRouter without a key.
 */
export function isOcrAvailable(): boolean {
  if (!env.OCR_ENABLED) {
    return false;
  }

  if (env.OCR_PROVIDER === "openrouter") {
    return Boolean(env.OPENROUTER_API_KEY);
  }

  return true;
}

/**
 * Transcribe a rendered page image to text.
 *
 * - `local`: always tesseract.js (free, offline).
 * - `openrouter`: always the cloud vision model.
 * - `auto` (default): cloud vision model, transparently falling back to local
 *   OCR when there is no API key or the account is out of credits.
 */
export async function ocrImage(image: Buffer, mimeType = "image/png"): Promise<string> {
  return ocrLimit(() => dispatch(image, mimeType));
}

async function dispatch(image: Buffer, mimeType: string): Promise<string> {
  if (env.OCR_PROVIDER === "local") {
    return localOcr(image);
  }

  if (env.OCR_PROVIDER === "openrouter") {
    return visionOcr(image, mimeType);
  }

  // auto
  if (!env.OPENROUTER_API_KEY) {
    return localOcr(image);
  }

  try {
    const visionText = await visionOcr(image, mimeType);

    // The vision model is usually the more reliable reader, but it can still
    // misfire on a hard page. When its own output looks weak, get a second
    // opinion from local tesseract and keep whichever one actually scores
    // better, instead of committing to a single engine's mistake.
    if (evaluateTextQuality(visionText).score < env.OCR_MIN_TEXT_SCORE) {
      const localText = await localOcr(image).catch(() => "");
      if (localText && evaluateTextQuality(localText).score > evaluateTextQuality(visionText).score) {
        return localText;
      }
    }

    return visionText;
  } catch (error) {
    if (error instanceof ApiError && FALLBACK_CODES.has(error.code)) {
      if (!warnedFallback) {
        console.warn(`[ocr] cloud OCR unavailable (${error.code}); falling back to local tesseract`);
        warnedFallback = true;
      }
      return localOcr(image);
    }

    throw error;
  }
}
