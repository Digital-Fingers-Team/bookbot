import type { QuizRequest } from "../../types/rag.js";

const QUIZ_TRIGGER = /\b(test\s+me|quiz\s+me|ask\s+me\s+(?:a\s+)?question|make\s+(?:me\s+)?(?:a\s+)?(?:quiz|\d+[^.!?]{0,40}questions?)|create\s+[^.!?]{0,40}questions?|generate\s+(?:some\s+)?questions?)\b|(?:اختبرني|امتحنني|اسألني|اعمل لي اختبار|اصنع لي أسئلة)/iu;

export function parseQuizRequest(question: string, currentPage?: number): QuizRequest | undefined {
  if (!QUIZ_TRIGGER.test(question)) return undefined;

  const requestedTotal = readNumber(question, /(?:\b|^)\s*(\d+)\s+(?:questions?|أسئلة|سؤال)/iu);
  const requestedMcq = readNumber(question, /(\d+)\s+(?:multiple[- ]choice|mcq|اختيار(?:ات)?\s+من\s+متعدد)/iu);
  const requestedEssay = readNumber(question, /(\d+)\s+(?:essay|open[- ]ended|مقالي(?:ة)?)/iu);
  const asksEssay = requestedEssay !== undefined || /\b(?:essay|open[- ]ended)\b|مقالي/iu.test(question);
  const asksMcq = requestedMcq !== undefined || /\b(?:multiple[- ]choice|mcq|choices?)\b|اختيار(?:ات)?\s+من\s+متعدد/iu.test(question);

  let essayCount = requestedEssay ?? (asksEssay && !asksMcq ? requestedTotal ?? 1 : 0);
  let mcqCount = requestedMcq ?? (asksMcq || !asksEssay ? requestedTotal ?? 1 : 0);
  if (requestedTotal !== undefined && requestedMcq !== undefined && requestedEssay === undefined) {
    essayCount = Math.max(0, requestedTotal - requestedMcq);
  }
  if (requestedTotal !== undefined && requestedEssay !== undefined && requestedMcq === undefined) {
    mcqCount = Math.max(0, requestedTotal - requestedEssay);
  }

  const total = Math.min(Math.max(mcqCount + essayCount, 1), 20);
  if (mcqCount + essayCount > 20) {
    mcqCount = Math.max(0, mcqCount - (mcqCount + essayCount - 20));
  }

  const asksWholeBook = /\b(?:whole|entire|full)\s+book\b|الكتاب\s+كله|الكتاب\s+بالكامل/iu.test(question);
  const asksPage = /\b(?:this|current)\s+page\b|هذه\s+الصفحة|الصفحة\s+الحالية/iu.test(question);
  const hasTopic = /\b(?:about|on|from|chapter|topic|section|unit)\b|الفصل|الموضوع|الجزء/iu.test(question);
  const scope = asksWholeBook ? "book" : asksPage || (currentPage !== undefined && !hasTopic) ? "page" : "topic";
  const difficulty = /\b(?:easy|easier|سهل|سهلة)\b/iu.test(question)
    ? "easy"
    : /\b(?:hard|difficult|صعب|صعبة)\b/iu.test(question)
      ? "hard"
      : "medium";

  return {
    mcqCount: Math.min(mcqCount, total),
    essayCount: Math.min(essayCount, total),
    difficulty,
    scope,
    currentPage
  };
}

function readNumber(question: string, pattern: RegExp) {
  const match = question.match(pattern);
  return match?.[1] ? Number(match[1]) : undefined;
}

export const QUIZ_OUTPUT_GUIDANCE = [
  "This is a quiz request. Generate exactly the requested number and mix of questions at the requested difficulty. Ground every question and answer in the supplied library excerpts. Do not use outside facts.",
  "",
  "Output ONLY one or more blocks in this exact format, with no introduction and no markdown fences:",
  "[QUIZ_QUESTION]",
  "type: multiple_choice",
  "question: <one clear question>",
  "option_a: <choice A>",
  "option_b: <choice B>",
  "option_c: <choice C>",
  "option_d: <choice D>",
  "answer: <A, B, C, or D>",
  "explanation: <short explanation grounded in the excerpts>",
  "[/QUIZ_QUESTION]",
  "",
  "For an essay question, use this format instead:",
  "[QUIZ_QUESTION]",
  "type: essay",
  "question: <one clear essay question>",
  "sample_answer: <a concise model answer grounded in the excerpts>",
  "[/QUIZ_QUESTION]",
  "",
  "Rules: every multiple-choice question MUST have exactly four distinct options labelled A-D; never include a fifth option. Keep the answer and sample answer inside the block so the app can provide feedback after the learner responds. Use the same language as the user's request. If the excerpts do not support enough questions, make only questions that are supported rather than inventing details."
].join("\n");

export function quizRequestSummary(quiz: QuizRequest) {
  return "Quiz requirements: " + quiz.mcqCount + " multiple-choice and " + quiz.essayCount +
    " essay question(s); difficulty " + quiz.difficulty + "; scope " + quiz.scope + ".";
}
