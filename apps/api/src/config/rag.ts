import { env } from "./env.js";

export const CHUNKING_VERSION = "v2";
export const PROCESSING_VERSION = "2026-06";

export function embeddingVersion() {
  return env.OPENROUTER_EMBEDDING_MODEL;
}
