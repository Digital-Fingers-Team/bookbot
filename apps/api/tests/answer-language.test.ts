import { describe, expect, it } from "vitest";
import {
  buildLanguageDirective,
  detectAnswerLanguage,
  notFoundMessage
} from "../src/utils/language.js";
import { buildUserPrompt } from "../src/services/generation/prompt.service.js";

const chunk = {
  id: "1",
  bookId: "book",
  bookName: "الإدارة الاستراتيجية",
  pageNumber: 3,
  chunkText: "إدارة المعرفة والميزة التنافسية.",
  score: 88,
  highlights: []
};

describe("answer language detection", () => {
  it("detects Arabic questions", () => {
    expect(detectAnswerLanguage("مهارات القيادة الادارية؟")).toBe("ar");
  });

  it("detects English questions", () => {
    expect(detectAnswerLanguage("What are administrative leadership skills?")).toBe("en");
  });

  it("follows the dominant script when a question mixes languages", () => {
    // An Arabic question quoting an English term stays Arabic.
    expect(detectAnswerLanguage("ما هي knowledge management؟")).toBe("ar");
    expect(detectAnswerLanguage("Compare strategic management و التخطيط")).toBe("en");
  });

  it("stays undecided when there are no letters to judge by", () => {
    expect(detectAnswerLanguage("123 ؟!")).toBeNull();
    expect(buildLanguageDirective(null)).toBe("");
  });
});

describe("not-found message", () => {
  it("answers an Arabic question in Arabic", () => {
    expect(notFoundMessage("مهارات القيادة الادارية؟")).toBe("لم أجد هذه المعلومة في الكتب.");
  });

  it("answers an English question in English", () => {
    expect(notFoundMessage("What are leadership skills?")).toContain("couldn't find");
  });
});

describe("prompt language directive", () => {
  it("names Arabic explicitly for an Arabic question", () => {
    const prompt = buildUserPrompt("مهارات القيادة الادارية؟", [chunk]);
    expect(prompt).toContain("Write your entire reply in Arabic");
    // The refusal path is the one that used to leak English.
    expect(prompt).toContain("including any explanation that the books do not cover the question");
  });

  it("names English explicitly for an English question", () => {
    const prompt = buildUserPrompt("What are administrative leadership skills?", [chunk]);
    expect(prompt).toContain("Write your entire reply in English");
  });

  it("puts the directive last, where the model is most likely to obey it", () => {
    const prompt = buildUserPrompt("مهارات القيادة الادارية؟", [chunk]);
    expect(prompt.trimEnd().endsWith("Do not answer in any other language.")).toBe(true);
  });

  it("adds no directive when the language is undecidable", () => {
    const prompt = buildUserPrompt("123 ؟!", [chunk]);
    expect(prompt).not.toContain("Write your entire reply in");
  });
});
