import { env } from "../../../config/env.js";
import type { GenerateAnswerInput, GenerateAnswerResult } from "../../../types/rag.js";
import { ApiError } from "../../../utils/api-error.js";
import { parseAnswerOnlyJson } from "../answer-parser.service.js";
import { buildUserPrompt, STRICT_RAG_SYSTEM_PROMPT } from "../prompt.service.js";
import type { LLMProvider } from "../llm-provider.service.js";

type OpenRouterResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

export class OpenRouterProvider implements LLMProvider {
  async generateAnswer(input: GenerateAnswerInput): Promise<GenerateAnswerResult> {
    if (!env.OPENROUTER_API_KEY) {
      throw new ApiError(503, "OPENROUTER_NOT_CONFIGURED", "OpenRouter generation is not configured yet.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    const model = input.model || env.OPENROUTER_MODEL;

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://bookbot.local",
          "X-Title": "BookBot"
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          max_tokens: 700,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: STRICT_RAG_SYSTEM_PROMPT },
            { role: "user", content: buildUserPrompt(input.question, input.chunks) }
          ]
        })
      });

      if (!response.ok) {
        throw new ApiError(502, "OPENROUTER_FAILURE", "The AI provider could not complete the answer right now.");
      }

      const payload = (await response.json()) as OpenRouterResponse;
      const content = payload.choices?.[0]?.message?.content?.trim();
      if (!content) {
        throw new ApiError(502, "EMPTY_AI_RESPONSE", "The AI provider returned an empty answer.");
      }

      return {
        answer: parseAnswerOnlyJson(content),
        model,
        usage: {
          promptTokens: payload.usage?.prompt_tokens,
          completionTokens: payload.usage?.completion_tokens,
          totalTokens: payload.usage?.total_tokens
        }
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(502, "OPENROUTER_FAILURE", "The AI provider could not complete the answer right now.");
    } finally {
      clearTimeout(timeout);
    }
  }
}
