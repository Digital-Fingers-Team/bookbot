import { describe, expect, it } from "vitest";
import { chunkPages } from "../src/services/ingestion/chunker.service.js";

describe("chunkPages", () => {
  it("preserves page numbers and keeps large chunks bounded", () => {
    const text = Array.from({ length: 80 }, (_, index) => `Sentence ${index} explains reliable retrieval.`).join(" ");
    const chunks = chunkPages([{ pageNumber: 7, text }], { minChars: 500, maxChars: 900, overlapChars: 80 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.pageNumber === 7)).toBe(true);
    expect(chunks.every((chunk) => chunk.chunkText.length <= 900)).toBe(true);
  });
});
