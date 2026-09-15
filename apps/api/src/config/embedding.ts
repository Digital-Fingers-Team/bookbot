import { env } from "./env.js";

export type EmbeddingSettings = {
  provider: "openrouter" | "local";
  baseUrl: string;
  apiKey?: string;
  model: string;
  dimensions: number;
  /**
   * How many characters may go into one embedding request.
   *
   * A hosted endpoint answers a large batch in seconds, so a big budget keeps
   * the number of round trips down. A local model is CPU-bound and shares the
   * box with OCR and rendering, where the same batch can run for minutes and
   * trip the HTTP client's headers timeout — so it gets a much smaller one.
   */
  maxBatchChars: number;
};

const OPENROUTER_MAX_BATCH_CHARS = 50000;
const LOCAL_MAX_BATCH_CHARS = 4000;

export function getEmbeddingSettings(): EmbeddingSettings {
  if (env.EMBEDDING_PROVIDER === "local") {
    return {
      provider: "local",
      baseUrl: env.LOCAL_EMBEDDING_BASE_URL,
      apiKey: env.LOCAL_EMBEDDING_API_KEY,
      model: env.LOCAL_EMBEDDING_MODEL,
      dimensions: env.LOCAL_EMBEDDING_DIMENSIONS,
      maxBatchChars: env.EMBEDDING_MAX_BATCH_CHARS ?? LOCAL_MAX_BATCH_CHARS
    };
  }

  return {
    provider: "openrouter",
    baseUrl: env.OPENROUTER_BASE_URL,
    apiKey: env.OPENROUTER_API_KEY,
    model: env.OPENROUTER_EMBEDDING_MODEL,
    dimensions: env.OPENROUTER_EMBEDDING_DIMENSIONS,
    maxBatchChars: env.EMBEDDING_MAX_BATCH_CHARS ?? OPENROUTER_MAX_BATCH_CHARS
  };
}
