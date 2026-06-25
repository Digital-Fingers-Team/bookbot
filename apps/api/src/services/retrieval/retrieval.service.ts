import { env } from "../../config/env.js";
import { embeddingVersion } from "../../config/rag.js";
import { Chunk } from "../../models/chunk.model.js";
import type { RetrievedChunk } from "../../types/rag.js";
import { ApiError } from "../../utils/api-error.js";
import { isLikelyTableOfContents } from "../../utils/text.js";
import { embedText } from "../embeddings/openrouter-embedding.service.js";
import { createReranker, type Reranker } from "./reranker.service.js";

type VectorChunk = {
  _id: unknown;
  bookId: unknown;
  bookName: string;
  pageNumber: number;
  chunkIndex: number;
  chunkText: string;
  normalizedText: string;
  score?: number;
};

export type RetrievalResult = {
  chunks: RetrievedChunk[];
  vectorCandidateCount: number;
};

// Small in-process LRU of query embeddings. The query embedding is a network
// round-trip to OpenRouter on the critical path before any answer can stream,
// so repeating a question (or asking a common one) skips it entirely.
const QUERY_EMBEDDING_CACHE_MAX = 256;
const queryEmbeddingCache = new Map<string, number[]>();

async function embedQuery(question: string): Promise<number[]> {
  const key = question.trim();
  const cached = queryEmbeddingCache.get(key);
  if (cached) {
    // Refresh recency for the LRU eviction below.
    queryEmbeddingCache.delete(key);
    queryEmbeddingCache.set(key, cached);
    return cached;
  }

  const vector = await embedText(question);
  queryEmbeddingCache.set(key, vector);
  if (queryEmbeddingCache.size > QUERY_EMBEDDING_CACHE_MAX) {
    const oldest = queryEmbeddingCache.keys().next().value;
    if (oldest !== undefined) {
      queryEmbeddingCache.delete(oldest);
    }
  }
  return vector;
}

export async function retrieveRelevantChunks(
  question: string,
  topK = 15,
  reranker: Reranker = createReranker()
): Promise<RetrievalResult> {
  const boundedTopK = boundTopK(topK);
  const queryVector = await embedQuery(question);
  const candidateLimit = Math.min(Math.max(50, boundedTopK * 4), env.VECTOR_CANDIDATE_MAX);
  const numCandidates = candidateLimit * env.VECTOR_NUM_CANDIDATES_MULTIPLIER;
  const candidates = await vectorSearch(queryVector, candidateLimit, numCandidates);

  if (!candidates.length) {
    return {
      chunks: [],
      vectorCandidateCount: 0
    };
  }

  // Drop table-of-contents / index (فهرس) pages: they match many queries on
  // keywords but never answer them, and look like noise as evidence.
  const retrieved = candidates.map(toRetrievedChunk);
  const usable = retrieved.filter((chunk) => !isLikelyTableOfContents(chunk.chunkText));

  const chunks = await reranker.rerank({
    question,
    topK: boundedTopK,
    candidates: usable
  });

  return {
    chunks,
    vectorCandidateCount: candidates.length
  };
}

async function vectorSearch(queryVector: number[], limit: number, numCandidates: number): Promise<VectorChunk[]> {
  try {
    return (await Chunk.aggregate([
      {
        $vectorSearch: {
          index: env.ATLAS_VECTOR_INDEX_NAME,
          path: "embedding",
          queryVector,
          numCandidates,
          limit
        }
      },
      {
        $match: {
          embeddingModel: env.OPENROUTER_EMBEDDING_MODEL,
          embeddingVersion: embeddingVersion()
        }
      },
      {
        $project: {
          bookId: 1,
          bookName: 1,
          pageNumber: 1,
          chunkIndex: 1,
          chunkText: 1,
          normalizedText: 1,
          score: { $meta: "vectorSearchScore" }
        }
      }
    ])) as VectorChunk[];
  } catch {
    throw new ApiError(
      503,
      "VECTOR_SEARCH_UNAVAILABLE",
      "Vector search is not available. Configure MongoDB Atlas Vector Search and create the chunk embedding index."
    );
  }
}

function toRetrievedChunk(chunk: VectorChunk): RetrievedChunk {
  const vectorScore = typeof chunk.score === "number" ? chunk.score : 0;

  return {
    id: String(chunk._id),
    bookId: String(chunk.bookId),
    bookName: chunk.bookName,
    pageNumber: chunk.pageNumber,
    chunkIndex: chunk.chunkIndex,
    chunkText: chunk.chunkText,
    score: vectorScore,
    vectorScore,
    highlights: []
  };
}

function boundTopK(topK: number) {
  return Math.min(Math.max(topK, 1), 75);
}
