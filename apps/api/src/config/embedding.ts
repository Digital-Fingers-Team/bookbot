import { env } from "./env.js";

export type EmbeddingSettings = {
  provider: "openrouter" | "local";
  baseUrl: string;
  apiKey?: string;
  model: string;
  dimensions: number;
};

export function getEmbeddingSettings(): EmbeddingSettings {
  if (env.EMBEDDING_PROVIDER === "local") {
    return {
      provider: "local",
      baseUrl: env.LOCAL_EMBEDDING_BASE_URL,
      apiKey: env.LOCAL_EMBEDDING_API_KEY,
      model: env.LOCAL_EMBEDDING_MODEL,
      dimensions: env.LOCAL_EMBEDDING_DIMENSIONS
    };
  }

  return {
    provider: "openrouter",
    baseUrl: env.OPENROUTER_BASE_URL,
    apiKey: env.OPENROUTER_API_KEY,
    model: env.OPENROUTER_EMBEDDING_MODEL,
    dimensions: env.OPENROUTER_EMBEDDING_DIMENSIONS
  };
}
