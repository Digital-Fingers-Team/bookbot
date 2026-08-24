import type { GenerateAnswerInput, GenerateAnswerResult } from "../../types/rag.js";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";
import { LocalLLMProvider } from "./providers/local.provider.js";
import { OpenRouterProvider } from "./providers/openrouter.provider.js";

export interface LLMProvider {
  generateAnswer(input: GenerateAnswerInput): Promise<GenerateAnswerResult>;
  streamAnswer?(input: GenerateAnswerInput): AsyncGenerator<string>;
}

export function createLLMProvider(providerName: string = env.LLM_PROVIDER): LLMProvider {
  if (providerName === "openrouter") {
    return new OpenRouterProvider();
  }

  if (providerName === "local") {
    return new LocalLLMProvider();
  }

  throw new ApiError(400, "UNSUPPORTED_LLM_PROVIDER", "This AI provider is not supported.");
}
