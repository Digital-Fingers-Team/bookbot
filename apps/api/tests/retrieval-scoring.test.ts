import { describe, expect, it } from "vitest";
import { buildHighlights } from "../src/services/retrieval/highlight.service.js";
import { tokenizeQuery } from "../src/services/retrieval/tokenizer.service.js";

describe("retrieval helpers", () => {
  it("removes trivial stopwords from query tokens", () => {
    expect(tokenizeQuery("What is the retrieval policy in chapter seven?")).toEqual([
      "retrieval",
      "policy",
      "chapter",
      "seven"
    ]);
  });

  it("builds keyword highlight spans", () => {
    const highlights = buildHighlights("Hybrid search combines keyword search and fuzzy search.", [
      "search",
      "keyword"
    ]);

    expect(highlights.length).toBeGreaterThanOrEqual(3);
    expect(highlights[0]).toMatchObject({ term: "search" });
  });
});
