import { env } from "./env.js";

export type LLMSettings = {
  name: "OpenRouter" | "Local LLM";
  baseUrl: string;
  apiKey?: string;
  model: string;
  requiresApiKey: boolean;
  jsonMode: boolean;
};

export function getLLMSettings(provider = env.LLM_PROVIDER): LLMSettings {
  if (provider === "local") {
    return {
      name: "Local LLM",
      baseUrl: env.LOCAL_LLM_BASE_URL,
      apiKey: env.LOCAL_LLM_API_KEY,
      model: env.LOCAL_LLM_MODEL,
      requiresApiKey: false,
      jsonMode: env.LOCAL_LLM_JSON_MODE
    };
  }

  return {
    name: "OpenRouter",
    baseUrl: env.OPENROUTER_BASE_URL,
    apiKey: env.OPENROUTER_API_KEY,
    model: env.OPENROUTER_MODEL,
    requiresApiKey: true,
    jsonMode: true
  };
}

export function getConfiguredLLMModel(provider = env.LLM_PROVIDER): string {
  return getLLMSettings(provider).model;
}
