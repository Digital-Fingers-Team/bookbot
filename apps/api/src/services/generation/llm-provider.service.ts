import type { GenerateAnswerInput, GenerateAnswerResult } from "../../types/rag.js";
import { ApiError } from "../../utils/api-error.js";
import { OpenRouterProvider } from "./providers/openrouter.provider.js";

export interface LLMProvider {
  generateAnswer(input: GenerateAnswerInput): Promise<GenerateAnswerResult>;
}

export function createLLMProvider(providerName = "openrouter"): LLMProvider {
  if (providerName === "openrouter") {
    return new OpenRouterProvider();
  }

  throw new ApiError(400, "UNSUPPORTED_LLM_PROVIDER", "This AI provider is not supported.");
}
