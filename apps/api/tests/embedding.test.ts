import { beforeEach, describe, expect, it, vi } from "vitest";

describe("OpenRouter embeddings", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("OPENROUTER_EMBEDDING_MODEL", "openai/text-embedding-3-small");
    vi.stubEnv("OPENROUTER_EMBEDDING_DIMENSIONS", "1536");
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
          model: "openai/text-embedding-3-small",
          data: [
            { index: 1, embedding: vectors[1] },
            { index: 0, embedding: vectors[0] }
          ],
          usage: { prompt_tokens: 12, total_tokens: 12 }
        })
      }))
    );

    const { embedTexts } = await import("../src/services/embeddings/openrouter-embedding.service.js");
    const result = await embedTexts(["first", "second"]);

    expect(result.embeddings).toEqual(vectors);
    expect(result.model).toBe("openai/text-embedding-3-small");
    expect(result.usage.totalTokens).toBe(12);
    expect(fetch).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/embeddings",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("\"input\":[\"first\",\"second\"]")
      })
    );
  });
});
