import { env } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";

type ChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string; code?: number | string };
};

const OCR_PROMPT =
  "You are an OCR engine. Transcribe ALL text on this book page exactly as it appears, " +
  "preserving the natural reading order and line breaks. The text is mostly Arabic; output the " +
  "Arabic verbatim including diacritics. Do NOT translate, summarize, explain, or add any " +
  "commentary, headings, or markdown. If the page has no readable text, return an empty response. " +
  "Output only the transcribed text.";

const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 60_000;

/**
 * Transcribe a rendered page image to text using an OpenRouter vision model.
 * This is the reliable path for PDFs whose embedded-font text layer is broken,
 * because it reads the rendered pixels rather than the corrupt character codes.
 *
 * Throws an `ApiError` with code `OCR_OUT_OF_CREDITS` or `OPENROUTER_NOT_CONFIGURED`
 * when the cloud provider cannot be used, so callers can fall back to local OCR.
 */
export async function visionOcr(image: Buffer, mimeType = "image/png"): Promise<string> {
  if (!env.OPENROUTER_API_KEY) {
    throw new ApiError(503, "OPENROUTER_NOT_CONFIGURED", "OpenRouter OCR is not configured yet.");
  }

  const dataUrl = `data:${mimeType};base64,${image.toString("base64")}`;
  const body = JSON.stringify({
    model: env.OCR_VISION_MODEL,
    temperature: 0,
    max_tokens: env.OCR_MAX_OUTPUT_TOKENS,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: OCR_PROMPT },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
  });

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${env.OPENROUTER_BASE_URL}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://aradobot.local",
          "X-Title": "AradoBot OCR",
        },
        body,
      });

      if (response.ok) {
        const payload = (await response.json()) as ChatResponse;
        return stripFences(payload.choices?.[0]?.message?.content ?? "");
      }

      const errorBody = await response.text();

      // Out of credits: retrying will not help; signal a fallback to local OCR.
      if (response.status === 402) {
        console.error("OCR provider error 402 (out of credits):", errorBody.slice(0, 300));
        throw new ApiError(502, "OCR_OUT_OF_CREDITS", "The OpenRouter account is out of credits for OCR.");
      }

      // Bad request / model unavailable: retrying will not help.
      if (response.status === 400 || response.status === 404) {
        console.error(`OCR provider error ${response.status}:`, errorBody.slice(0, 500));
        throw new ApiError(502, "OCR_PROVIDER_ERROR", "OCR failed: the vision model rejected the request.");
      }

      // Rate limited (429) or transient 5xx: back off and retry.
      lastError = new Error(`OCR HTTP ${response.status}: ${errorBody.slice(0, 200)}`);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }

    if (attempt < MAX_ATTEMPTS) {
      await delay(500 * 2 ** (attempt - 1));
    }
  }

  console.error("OCR provider failed after retries:", lastError);
  throw new ApiError(502, "OCR_PROVIDER_ERROR", "The OCR provider could not read this page right now.");
}

function stripFences(text: string): string {
  return text
    .replace(/^﻿/, "")
    .replace(/^```[a-zA-Z]*\n?/, "")
    .replace(/```$/, "")
    .trim();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
