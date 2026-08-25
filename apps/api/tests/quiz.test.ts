import { describe, expect, it } from "vitest";
import { parseQuizRequest } from "../src/services/generation/quiz.service.js";

describe("quiz request parsing", () => {
  it("parses a teacher batch with four-choice MCQs and essays", () => {
    expect(parseQuizRequest("make 10 medium questions about chapter 7: 7 multiple choices and 3 essay")).toMatchObject({
      mcqCount: 7,
      essayCount: 3,
      difficulty: "medium",
      scope: "topic"
    });
  });

  it("uses the current page for a simple test-me request", () => {
    expect(parseQuizRequest("test me", 12)).toMatchObject({
      mcqCount: 1,
      essayCount: 0,
      scope: "page"
    });
  });

  it("supports essay-only and whole-book requests", () => {
    expect(parseQuizRequest("quiz me with 3 essay questions from the whole book")).toMatchObject({
      mcqCount: 0,
      essayCount: 3,
      scope: "book"
    });
  });
});
