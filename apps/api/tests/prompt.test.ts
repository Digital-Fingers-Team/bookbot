import { describe, expect, it } from "vitest";
import { buildUserPrompt, STRICT_RAG_SYSTEM_PROMPT } from "../src/services/generation/prompt.service.js";

describe("prompt builder", () => {
  it("keeps generation constrained to retrieved chunks", () => {
    const prompt = buildUserPrompt("What does the book say?", [
      {
        id: "1",
        bookId: "book",
        bookName: "System Design",
        pageNumber: 12,
        chunkText: "Use only retrieved chunks.",
        score: 91,
        highlights: []
      }
    ]);

    expect(STRICT_RAG_SYSTEM_PROMPT).toContain("Use ONLY provided context");
    expect(prompt).toContain("Use only retrieved chunks.");
    expect(prompt).not.toContain("database");
  });
});
