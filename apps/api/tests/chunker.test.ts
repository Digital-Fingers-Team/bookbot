import { describe, expect, it } from "vitest";
import { chunkPages } from "../src/services/ingestion/chunker.service.js";

describe("chunkPages", () => {
  it("preserves page numbers and keeps large chunks token bounded", () => {
    const text = Array.from({ length: 80 }, (_, index) => `Sentence ${index} explains reliable retrieval.`).join(" ");
    const chunks = chunkPages([{ pageNumber: 7, text }], { minTokens: 40, maxTokens: 80, overlapTokens: 10 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.pageNumber === 7)).toBe(true);
    expect(chunks.every((chunk) => chunk.chunkText.split(/\s+/).length <= 80)).toBe(true);
    expect(chunks.map((chunk) => chunk.chunkIndex)).toEqual(chunks.map((_, index) => index));
  });

  it("does not break normal sentences mid-way", () => {
    const chunks = chunkPages(
      [
        {
          pageNumber: 2,
          text: "Alpha retrieval sentence stays whole. Beta retrieval sentence stays whole. Gamma retrieval sentence stays whole."
        }
      ],
      { minTokens: 3, maxTokens: 5, overlapTokens: 0 }
    );

    expect(chunks.every((chunk) => /[.!?]$/.test(chunk.chunkText))).toBe(true);
  });
});
