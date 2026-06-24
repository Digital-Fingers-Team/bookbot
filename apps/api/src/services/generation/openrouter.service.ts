import type { RetrievedChunk } from "../../types/rag.js";
import { OpenRouterProvider } from "./providers/openrouter.provider.js";

export async function generateAnswer(input: {
  question: string;
  chunks: RetrievedChunk[];
  model?: string;
}) {
  const result = await new OpenRouterProvider().generateAnswer(input);
  return {
    content: result.answer,
    model: result.model,
    usage: result.usage ?? {}
  };
}
