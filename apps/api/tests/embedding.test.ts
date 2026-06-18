import { beforeEach, describe, expect, it, vi } from "vitest";

describe("OpenAI embeddings", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_EMBEDDING_DIMENSIONS", "1536");
  });

  it("embeds batches and preserves provider order by index", async () => {
    const vectors = [
      Array.from({ length: 1536 }, () => 0.2),
      Array.from({ length: 1536 }, () => 0.1)
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          model: "text-embedding-3-small",
          data: [
            { index: 1, embedding: vectors[1] },
            { index: 0, embedding: vectors[0] }
          ],
          usage: { prompt_tokens: 12, total_tokens: 12 }
        })
      }))
    );

    const { embedTexts } = await import("../src/services/embeddings/openai-embedding.service.js");
    const result = await embedTexts(["first", "second"]);

    expect(result.embeddings).toEqual(vectors);
    expect(result.model).toBe("text-embedding-3-small");
    expect(result.usage.totalTokens).toBe(12);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/embeddings",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("\"input\":[\"first\",\"second\"]")
      })
    );
  });
});
