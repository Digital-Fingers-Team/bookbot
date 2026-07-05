import { env } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";

type OpenRouterEmbeddingResponse = {
  data?: Array<{
    embedding?: number[];
    index?: number;
  }>;
  model?: string;
  usage?: {
    prompt_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
    code?: string;
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

const EMBEDDING_MAX_ATTEMPTS = 3;
const EMBEDDING_RETRY_DELAY_MS = 2000;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** POST to the embeddings endpoint, retrying transient network failures (e.g. a
 * dropped connection mid-way through a long multi-batch ingestion job). */
async function fetchEmbeddings(texts: string[]): Promise<Response> {
  for (let attempt = 1; attempt <= EMBEDDING_MAX_ATTEMPTS; attempt++) {
    try {
      return await fetch(`${env.OPENROUTER_BASE_URL}/embeddings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://aradobot.local",
          "X-Title": "AradoBot"
        },
        body: JSON.stringify({
          input: texts,
          model: env.OPENROUTER_EMBEDDING_MODEL,
          encoding_format: "float"
        })
      });
    } catch (error) {
      if (attempt === EMBEDDING_MAX_ATTEMPTS) {
        throw error;
      }
      console.warn(
        `[embeddings] fetch attempt ${attempt} failed, retrying:`,
        error instanceof Error ? error.message : error
      );
      await delay(EMBEDDING_RETRY_DELAY_MS * attempt);
    }
  }
  throw new Error("unreachable");
}

export async function embedTexts(
  texts: string[]
): Promise<EmbeddingBatchResult> {
  if (!texts.length) {
    return {
      embeddings: [],
      model: env.OPENROUTER_EMBEDDING_MODEL,
      dimensions: env.OPENROUTER_EMBEDDING_DIMENSIONS,
      usage: {}
    };
  }

  if (!env.OPENROUTER_API_KEY) {
    throw new ApiError(
      503,
      "OPENROUTER_NOT_CONFIGURED",
      "OpenRouter embeddings are not configured yet."
    );
  }

  const response = await fetchEmbeddings(texts);

  const payload = (await response.json()) as OpenRouterEmbeddingResponse;

  if (!response.ok) {
    console.error(
      "OpenRouter Embedding API Error:",
      response.status,
      JSON.stringify(payload, null, 2)
    );

    throw new ApiError(
      502,
      "OPENROUTER_EMBEDDING_FAILURE",
      "The embedding provider could not process this book."
    );
  }

  if (payload.error) {
    console.error(
      "OpenRouter returned an embedding error:",
      payload.error
    );

    throw new ApiError(
      502,
      "OPENROUTER_EMBEDDING_FAILURE",
      payload.error.message ??
        "The embedding provider returned an error."
    );
  }

  const ordered = [...(payload.data ?? [])].sort(
    (a, b) => (a.index ?? 0) - (b.index ?? 0)
  );

  const embeddings = ordered
    .map((item) => item.embedding)
    .filter(
      (embedding): embedding is number[] =>
        Array.isArray(embedding)
    );

  if (
    embeddings.length !== texts.length ||
    embeddings.some(
      (embedding) =>
        embedding.length !==
        env.OPENROUTER_EMBEDDING_DIMENSIONS
    )
  ) {
    console.error(
      "Invalid embeddings response",
      {
        requestedTexts: texts.length,
        receivedEmbeddings: embeddings.length,
        expectedDimensions:
          env.OPENROUTER_EMBEDDING_DIMENSIONS,
        actualDimensions:
          embeddings[0]?.length,
        model: payload.model,
        rawDataLength:
          payload.data?.length ?? 0
      }
    );

    throw new ApiError(
      502,
      "INVALID_EMBEDDING_RESPONSE",
      "The embedding provider returned invalid vectors."
    );
  }

  return {
    embeddings,
    model:
      payload.model ??
      env.OPENROUTER_EMBEDDING_MODEL,
    dimensions:
      env.OPENROUTER_EMBEDDING_DIMENSIONS,
    usage: {
      promptTokens:
        payload.usage?.prompt_tokens,
      totalTokens:
        payload.usage?.total_tokens
    }
  };
}

export async function embedText(text: string) {
  const result = await embedTexts([text]);

  const embedding = result.embeddings[0];

  if (!embedding) {
    throw new ApiError(
      502,
      "INVALID_EMBEDDING_RESPONSE",
      "The embedding provider returned no vector."
    );
  }

  return embedding;
}