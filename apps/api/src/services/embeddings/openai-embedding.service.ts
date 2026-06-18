import { env } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";

type OpenAIEmbeddingResponse = {
  data?: Array<{ embedding?: number[]; index?: number }>;
  model?: string;
  usage?: {
    prompt_tokens?: number;
    total_tokens?: number;
  };
};

export type EmbeddingBatchResult = {
  embeddings: number[][];
  model: string;
  dimensions: number;
  usage: {
    promptTokens?: number;
    totalTokens?: number;
  };
};

export async function embedTexts(texts: string[]): Promise<EmbeddingBatchResult> {
  if (!texts.length) {
    return {
      embeddings: [],
      model: env.OPENAI_EMBEDDING_MODEL,
      dimensions: env.OPENAI_EMBEDDING_DIMENSIONS,
      usage: {}
    };
  }

  if (!env.OPENAI_API_KEY) {
    throw new ApiError(503, "OPENAI_NOT_CONFIGURED", "OpenAI embeddings are not configured yet.");
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      input: texts,
      model: env.OPENAI_EMBEDDING_MODEL,
      dimensions: env.OPENAI_EMBEDDING_DIMENSIONS,
      encoding_format: "float"
    })
  });

  if (!response.ok) {
    throw new ApiError(502, "OPENAI_EMBEDDING_FAILURE", "The embedding provider could not process this book.");
  }

  const payload = (await response.json()) as OpenAIEmbeddingResponse;
  const ordered = [...(payload.data ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const embeddings = ordered.map((item) => item.embedding).filter((embedding): embedding is number[] => Array.isArray(embedding));

  if (embeddings.length !== texts.length || embeddings.some((embedding) => embedding.length !== env.OPENAI_EMBEDDING_DIMENSIONS)) {
    throw new ApiError(502, "INVALID_EMBEDDING_RESPONSE", "The embedding provider returned invalid vectors.");
  }

  return {
    embeddings,
    model: payload.model ?? env.OPENAI_EMBEDDING_MODEL,
    dimensions: env.OPENAI_EMBEDDING_DIMENSIONS,
    usage: {
      promptTokens: payload.usage?.prompt_tokens,
      totalTokens: payload.usage?.total_tokens
    }
  };
}

export async function embedText(text: string) {
  const result = await embedTexts([text]);
  const embedding = result.embeddings[0];
  if (!embedding) {
    throw new ApiError(502, "INVALID_EMBEDDING_RESPONSE", "The embedding provider returned no vector.");
  }

  return embedding;
}
