import { describe, expect, it } from "vitest";
import type { RetrievedChunk } from "../src/types/rag.js";
import { FutureCrossEncoderReranker, HybridReranker, type Reranker } from "../src/services/retrieval/reranker.service.js";

const chunks: RetrievedChunk[] = [
  chunk("a", "book-a", "Alpha", "Unrelated appendix material.", 0.8),
  chunk("b", "book-b", "Beta", "Vector search reranking improves retrieval quality.", 0.7)
];

describe("rerankers", () => {
  it("uses the reranker interface and improves hybrid relevance", async () => {
    const reranker: Reranker = new HybridReranker();
    const [best] = await reranker.rerank({
      question: "How does reranking improve retrieval quality?",
      candidates: chunks,
      topK: 2
    });

    expect(best?.id).toBe("b");
  });

  it("keeps the future cross-encoder placeholder pluggable", async () => {
    const reranker: Reranker = new FutureCrossEncoderReranker();
    const result = await reranker.rerank({
      question: "retrieval quality",
      candidates: chunks,
      topK: 1
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("a");
  });
});

function chunk(id: string, bookId: string, bookName: string, chunkText: string, vectorScore: number): RetrievedChunk {
  return {
    id,
    bookId,
    bookName,
    pageNumber: 1,
    chunkText,
    score: vectorScore,
    vectorScore,
    highlights: []
  };
}
