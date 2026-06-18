import { env } from "../../config/env.js";
import { embeddingVersion } from "../../config/rag.js";
import { Chunk } from "../../models/chunk.model.js";
import type { RetrievedChunk } from "../../types/rag.js";
import { ApiError } from "../../utils/api-error.js";
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

export async function retrieveRelevantChunks(
  question: string,
  topK = 15,
  reranker: Reranker = createReranker()
): Promise<RetrievalResult> {
  const boundedTopK = boundTopK(topK);
  const queryVector = await embedText(question);
  const candidateLimit = Math.min(Math.max(50, boundedTopK * 4), env.VECTOR_CANDIDATE_MAX);
  const numCandidates = candidateLimit * env.VECTOR_NUM_CANDIDATES_MULTIPLIER;
  const candidates = await vectorSearch(queryVector, candidateLimit, numCandidates);

  if (!candidates.length) {
    return {
      chunks: [],
      vectorCandidateCount: 0
    };
  }

  const chunks = await reranker.rerank({
    question,
    topK: boundedTopK,
    candidates: candidates.map(toRetrievedChunk)
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
          limit,
          filter: {
            embeddingModel: env.OPENROUTER_EMBEDDING_MODEL,
            embeddingVersion: embeddingVersion()
          }
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
