import { parseQuizRequest } from "../generation/quiz.service.js";
import { retrieveRelevantChunks } from "./retrieval.service.js";
import { retrieveBookChunks, retrievePageChunks } from "./quiz-retrieval.service.js";
import type { QuizRequest } from "../../types/rag.js";

type ChatRetrievalInput = {
  question: string;
  topK?: number;
  limit?: number;
  bookId?: string;
  page?: number;
  history?: { role: string; content: string }[];
};

export async function retrieveChatChunks(input: ChatRetrievalInput, allowedBookIds: string[] | null) {
  const quiz = parseQuizRequest(input.question, input.page);
  const hasBookAccess = !input.bookId || allowedBookIds === null || allowedBookIds.includes(input.bookId);

  if (quiz?.scope === "page" && input.bookId && input.page && hasBookAccess) {
    return { retrieval: await retrievePageChunks(input.bookId, input.page), quiz };
  }
  if (quiz?.scope === "book" && input.bookId && hasBookAccess) {
    return { retrieval: await retrieveBookChunks(input.bookId), quiz };
  }

  const lastUser = input.history?.filter((turn) => turn.role === "user").at(-1)?.content?.trim();
  const retrievalQuery = lastUser ? lastUser + " " + input.question : input.question;
  return {
    retrieval: await retrieveRelevantChunks(
      retrievalQuery,
      input.topK ?? input.limit ?? 15,
      undefined,
      input.bookId,
      allowedBookIds
    ),
    quiz: quiz as QuizRequest | undefined
  };
}
