import { getEmbeddingSettings } from "../../config/embedding.js";
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
  const settings = getEmbeddingSettings();
  for (let attempt = 1; attempt <= EMBEDDING_MAX_ATTEMPTS; attempt++) {
    try {
      return await fetch(`${settings.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}),
          "Content-Type": "application/json",
          ...(settings.provider === "openrouter"
            ? { "HTTP-Referer": "https://aradobot.local", "X-Title": "AradoBot" }
            : {})
        },
        body: JSON.stringify({
          input: texts,
          model: settings.model,
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
  const settings = getEmbeddingSettings();
  if (!texts.length) {
    return {
      embeddings: [],
      model: settings.model,
      dimensions: settings.dimensions,
      usage: {}
    };
  }

  if (settings.provider === "openrouter" && !settings.apiKey) {
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
        settings.dimensions
    )
  ) {
    console.error(
      "Invalid embeddings response",
      {
        requestedTexts: texts.length,
        receivedEmbeddings: embeddings.length,
        expectedDimensions:
          settings.dimensions,
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
      settings.model,
    dimensions:
      settings.dimensions,
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
