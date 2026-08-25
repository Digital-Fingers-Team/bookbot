export type QuizQuestion =
  | {
      type: "multiple_choice";
      question: string;
      options: string[];
      answer: string;
      explanation: string;
    }
  | {
      type: "essay";
      question: string;
      sampleAnswer: string;
    };

export function parseQuiz(text: string): QuizQuestion[] {
  const blocks = [...text.matchAll(/\[QUIZ_QUESTION\]([\s\S]*?)\[\/QUIZ_QUESTION\]/gi)].map((match) => match[1] ?? "");
  const questions: QuizQuestion[] = [];
  for (const block of blocks) {
    const type = field(block, "type").toLowerCase();
    const question = field(block, "question");
    if (!question) continue;
    if (type === "essay") {
      questions.push({ type: "essay", question, sampleAnswer: field(block, "sample_answer") });
      continue;
    }
    const options = ["a", "b", "c", "d"].map((letter) => field(block, "option_" + letter));
    if (options.some((option) => !option)) continue;
    const answerText = field(block, "answer");
    const answer = answerText.match(/\b([A-D])\b/i)?.[1]?.toUpperCase() ?? answerText.toUpperCase().replace(/[^A-D]/g, "").slice(0, 1);
    questions.push({
      type: "multiple_choice",
      question,
      options,
      answer,
      explanation: field(block, "explanation")
    });
  }
  return questions;
}

function field(block: string, name: string) {
  const match = block.match(new RegExp("^" + name + "\\s*:\\s*(.*)$", "im"));
  return match?.[1]?.trim() ?? "";
}
