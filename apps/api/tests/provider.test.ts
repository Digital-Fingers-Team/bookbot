import { describe, expect, it, vi } from "vitest";
import { parseAnswerOnlyJson } from "../src/services/generation/answer-parser.service.js";
import type { RetrievedChunk } from "../src/types/rag.js";

const chunks: RetrievedChunk[] = [
  {
    id: "chunk",
    bookId: "book",
    bookName: "Hidden Source",
    pageNumber: 12,
    chunkText: "The answer is contained here.",
    score: 0.9,
    highlights: []
  }
];

describe("LLM providers", () => {
  it("parses answer-only JSON", () => {
    expect(parseAnswerOnlyJson('```json\n{"answer":"Only answer."}\n```')).toBe("Only answer.");
  });

  it("OpenRouter provider requests answer-only JSON", async () => {
    vi.resetModules();
    vi.stubEnv("OPENROUTER_API_KEY", "or-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "{\"answer\":\"OpenRouter answer.\"}" } }],
          usage: { total_tokens: 10 }
        })
      }))
    );

    const { OpenRouterProvider } = await import("../src/services/generation/providers/openrouter.provider.js");
    const result = await new OpenRouterProvider().generateAnswer({ question: "Question?", chunks });
    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));

    expect(result.answer).toBe("OpenRouter answer.");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages[0].content).toContain("Do not mention excerpts, chunks, context, book titles, page numbers, or ids");
  });

  it("rejects non-OpenRouter providers until another API key is available", async () => {
    vi.resetModules();
    const { createLLMProvider } = await import("../src/services/generation/llm-provider.service.js");

    expect(() => createLLMProvider("other-provider")).toThrow("This AI provider is not supported.");
  });
});
