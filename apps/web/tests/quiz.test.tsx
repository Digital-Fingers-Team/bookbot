import { describe, expect, it } from "vitest";
import { parseQuiz } from "../src/lib/quiz";

describe("quiz response parsing", () => {
  it("keeps exactly four multiple-choice options and parses essays", () => {
    const result = parseQuiz([
      "[QUIZ_QUESTION]",
      "type: multiple_choice",
      "question: What is the key idea?",
      "option_a: A",
      "option_b: B",
      "option_c: C",
      "option_d: D",
      "answer: C",
      "explanation: The text supports C.",
      "[/QUIZ_QUESTION]",
      "[QUIZ_QUESTION]",
      "type: essay",
      "question: Explain the idea.",
      "sample_answer: It means this.",
      "[/QUIZ_QUESTION]"
    ].join("\n"));

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ type: "multiple_choice", answer: "C", options: ["A", "B", "C", "D"] });
    expect(result[1]).toMatchObject({ type: "essay", sampleAnswer: "It means this." });
  });
});
