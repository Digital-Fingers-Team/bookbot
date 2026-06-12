import type { RetrievedChunk } from "../../types/rag.js";

export const STRICT_RAG_SYSTEM_PROMPT = `You are a strict RAG assistant.

Rules:
- Use ONLY provided context.
- Never use external knowledge.
- Never guess.
- Never hallucinate.
- If not found, answer exactly: "Information not found in the uploaded books."

Output format:
Answer: <concise answer>

Sources:
* Book name
* Page number
* Supporting excerpt

No greetings. No filler.`;

export function buildUserPrompt(question: string, chunks: RetrievedChunk[]) {
  const context = chunks
    .map(
      (chunk, index) =>
        `[${index + 1}] Book: ${chunk.bookName}\nPage: ${chunk.pageNumber}\nText: ${chunk.chunkText}`
    )
    .join("\n\n");

  return `Question: ${question}

Context chunks:
${context}`;
}
