import type { RetrievedChunk } from "../../types/rag.js";

export const STRICT_RAG_SYSTEM_PROMPT = `You are a strict RAG assistant.

Rules:
- Use ONLY provided context.
- Never use external knowledge.
- Never guess.
- Never hallucinate.
- Answer the user's exact question directly and concisely.
- Ignore unrelated profile metadata, contact details, navigation text, and sidebar text unless the question asks for it.
- If not found, answer exactly: "I couldn't find this information in the books."
- Do not cite books, pages, or chunk ids. The server will attach sources.

Output format:
{"answer":"<concise answer>"}

No greetings. No filler.`;

export function buildUserPrompt(question: string, chunks: RetrievedChunk[]) {
  const context = chunks
    .map(
      (chunk, index) =>
        `[${index + 1}]\nText: ${chunk.chunkText}`
    )
    .join("\n\n");

  return `Question: ${question}

Context chunks:
${context}`;
}
