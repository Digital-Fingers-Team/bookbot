import { describe, expect, it, vi } from "vitest";

vi.mock("../src/services/embeddings/openai-embedding.service.js", () => ({
  embedText: vi.fn(async () => [0.1, 0.2, 0.3])
}));

vi.mock("../src/models/chunk.model.js", () => ({
  Chunk: {
    aggregate: vi.fn(async () => [
      {
        _id: "chunk-1",
        bookId: "book-1",
        bookName: "Vector Book",
        pageNumber: 4,
        chunkIndex: 0,
        chunkText: "Atlas vector search retrieves candidates.",
        normalizedText: "atlas vector search retrieves candidates",
        score: 0.91
      }
    ])
  }
}));

describe("vector retrieval", () => {
  it("uses Atlas $vectorSearch and returns only top candidates to reranking", async () => {
    const { Chunk } = await import("../src/models/chunk.model.js");
    const { retrieveRelevantChunks } = await import("../src/services/retrieval/retrieval.service.js");

    const result = await retrieveRelevantChunks("vector search", 15);
    const pipeline = vi.mocked(Chunk.aggregate).mock.calls[0]?.[0] as unknown as Array<Record<string, unknown>>;

    expect(pipeline?.[0]).toHaveProperty("$vectorSearch");
    expect((pipeline?.[0]?.$vectorSearch as { limit?: number; numCandidates?: number }).limit).toBe(60);
    expect((pipeline?.[0]?.$vectorSearch as { limit?: number; numCandidates?: number }).numCandidates).toBe(1200);
    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0]?.id).toBe("chunk-1");
  });
});
