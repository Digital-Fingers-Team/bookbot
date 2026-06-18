import { env } from "../../config/env.js";
import type { GenerateAnswerInput, GenerateAnswerResult } from "../../types/rag.js";
import { ApiError } from "../../utils/api-error.js";
import { GeminiProvider } from "./providers/gemini.provider.js";
import { OpenRouterProvider } from "./providers/openrouter.provider.js";

export interface LLMProvider {
  generateAnswer(input: GenerateAnswerInput): Promise<GenerateAnswerResult>;
}

export function createLLMProvider(providerName = env.LLM_PROVIDER): LLMProvider {
  if (providerName === "gemini") {
    return new GeminiProvider();
  }

  if (providerName === "openrouter") {
    return new OpenRouterProvider();
  }

  throw new ApiError(400, "UNSUPPORTED_LLM_PROVIDER", "This AI provider is not supported.");
}
