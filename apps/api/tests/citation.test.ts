import { describe, expect, it } from "vitest";
import { buildSources } from "../src/services/generation/citation.service.js";

describe("buildSources", () => {
  it("uses supporting text near the relevant highlight instead of the start of the chunk", () => {
    const chunkText =
      "Contact baraasaad007@gmail.com LinkedIn profile details. ".repeat(12) +
      "Top Skills Full-Stack Development. " +
      "Baraa Saad Fullstack developer Banha, Egypt. Experience Freelance Full-stack Developer May 2025 - Present. " +
      "I build modern, fast, and responsive websites for brands, creators, and small businesses.";

    const [source] = buildSources([
      {
        id: "1",
        bookId: "book",
        bookName: "Profile.pdf",
        pageNumber: 1,
        chunkText,
        score: 80,
        highlights: [{ term: "Experience", start: chunkText.indexOf("Experience"), end: chunkText.indexOf("Experience") + 10 }]
      }
    ]);

    expect(source?.supportingText).toContain("Experience Freelance Full-stack Developer");
    expect(source?.supportingText.startsWith("Contact")).toBe(false);
  });
});
