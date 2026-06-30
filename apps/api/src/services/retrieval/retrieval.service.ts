import { Types, isValidObjectId, type PipelineStage } from "mongoose";
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
  reranker: Reranker = createReranker(),
  bookId?: string,
  // Access scope: when a non-null array is passed, only chunks from these books
  // are eligible (regular users see their granted books only). null = no limit.
  allowedBookIds?: string[] | null
): Promise<RetrievalResult> {
  const boundedTopK = boundTopK(topK);
  const queryVector = await embedQuery(question);

  // The set of books this query may draw from (single-book scope ∩ access scope).
  const scopeIds = resolveScopeIds(bookId, allowedBookIds);
  const restricted = scopeIds !== null;

  // When restricted but we can't filter inside the index, post-filtering can
  // starve recall, so widen the candidate pool toward the cap.
  const baseLimit = Math.max(50, boundedTopK * 4);
  const candidateLimit = Math.min(restricted ? Math.max(baseLimit, 150) : baseLimit, env.VECTOR_CANDIDATE_MAX);
  const numCandidates = candidateLimit * env.VECTOR_NUM_CANDIDATES_MULTIPLIER;

  // Push the access/book filter into $vectorSearch when the index supports it.
  const indexFilter =
    env.VECTOR_INDEX_HAS_BOOK_FILTER && scopeIds && scopeIds.length
      ? { bookId: { $in: scopeIds.map((id) => new Types.ObjectId(id)) } }
      : undefined;
  const candidates = await vectorSearch(queryVector, candidateLimit, numCandidates, indexFilter);

  if (!candidates.length) {
    return {
      chunks: [],
      vectorCandidateCount: 0
    };
  }

  // Drop table-of-contents / index (فهرس) pages: they match many queries on
  // keywords but never answer them, and look like noise as evidence.
  const retrieved = candidates.map(toRetrievedChunk);
  let usable = retrieved.filter((chunk) => !isLikelyTableOfContents(chunk.chunkText));

  // Enforce access + single-book scope. Always applied (even when the index
  // filtered too) as a correctness guarantee — never serve a forbidden chunk.
  if (scopeIds) {
    const allow = new Set(scopeIds);
    usable = usable.filter((chunk) => allow.has(chunk.bookId));
  }

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

/**
 * Intersect the single-book scope with the access scope into a concrete list of
 * allowed book ids, or null when the query is unrestricted (admin, no bookId).
 */
function resolveScopeIds(bookId?: string, allowedBookIds?: string[] | null): string[] | null {
  if (bookId) {
    if (allowedBookIds && !allowedBookIds.includes(bookId)) {
      return []; // asked within a book the user can't access
    }
    return [bookId];
  }
  if (allowedBookIds) {
    return allowedBookIds.filter((id) => isValidObjectId(id));
  }
  return null;
}

async function vectorSearch(
  queryVector: number[],
  limit: number,
  numCandidates: number,
  filter?: Record<string, unknown>
): Promise<VectorChunk[]> {
  const vectorStage: Record<string, unknown> = {
    index: env.ATLAS_VECTOR_INDEX_NAME,
    path: "embedding",
    queryVector,
    numCandidates,
    limit
  };
  if (filter) {
    vectorStage.filter = filter;
  }

  try {
    return (await runVectorPipeline(vectorStage)) as VectorChunk[];
  } catch (error) {
    // If the index doesn't support the filter field, retry without it so the
    // post-search access filter still protects the results.
    if (filter) {
      try {
        const { filter: _omit, ...unfiltered } = vectorStage;
        return (await runVectorPipeline(unfiltered)) as VectorChunk[];
      } catch {
        throw vectorUnavailable();
      }
    }
    throw error instanceof ApiError ? error : vectorUnavailable();
  }
}

// Runs the $vectorSearch pipeline; errors propagate to vectorSearch, which
// decides whether to retry without the filter or surface a 503.
async function runVectorPipeline(vectorStage: Record<string, unknown>): Promise<VectorChunk[]> {
  return (await Chunk.aggregate([
    { $vectorSearch: vectorStage } as unknown as PipelineStage,
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
}

function vectorUnavailable() {
  return new ApiError(
    503,
    "VECTOR_SEARCH_UNAVAILABLE",
    "Vector search is not available. Configure MongoDB Atlas Vector Search and create the chunk embedding index."
  );
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
