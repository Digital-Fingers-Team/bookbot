import { env } from "../../../config/env.js";
import type { GenerateAnswerInput, GenerateAnswerResult } from "../../../types/rag.js";
import { ApiError } from "../../../utils/api-error.js";
import { parseAnswerOnlyJson } from "../answer-parser.service.js";
import {
  buildUserPrompt,
  STREAMING_RAG_SYSTEM_PROMPT,
  STRICT_RAG_SYSTEM_PROMPT
} from "../prompt.service.js";
import type { LLMProvider } from "../llm-provider.service.js";

type OpenRouterResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

type OpenRouterStreamChunk = {
  choices?: Array<{ delta?: { content?: string } }>;
};

// Map recent conversation turns into chat messages so follow-up questions keep
// context. Capped to the last few turns to bound the prompt size.
function toHistoryMessages(history?: GenerateAnswerInput["history"]) {
  if (!history?.length) {
    return [] as Array<{ role: "user" | "assistant"; content: string }>;
  }
  return history
    .filter((turn) => turn.content?.trim())
    .slice(-6)
    .map((turn) => ({ role: turn.role, content: turn.content }));
}

export class OpenRouterProvider implements LLMProvider {
  async generateAnswer(input: GenerateAnswerInput): Promise<GenerateAnswerResult> {
    if (!env.OPENROUTER_API_KEY) {
      throw new ApiError(503, "OPENROUTER_NOT_CONFIGURED", "OpenRouter generation is not configured yet.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    const model = input.model || env.OPENROUTER_MODEL;

    try {
      const response = await fetch(`${env.OPENROUTER_BASE_URL}/chat/completions`, {
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
          temperature: 0.2,
          max_tokens: 900,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: STRICT_RAG_SYSTEM_PROMPT },
            ...toHistoryMessages(input.history),
            { role: "user", content: buildUserPrompt(input.question, input.chunks) }
          ]
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`OpenRouter API Error: ${response.status} ${response.statusText}`, errorBody);
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

  /**
   * Stream the answer token by token. Falls back to a single non-streaming
   * completion if the provider cannot stream, so callers always get an answer.
   */
  async *streamAnswer(input: GenerateAnswerInput): AsyncGenerator<string> {
    if (!env.OPENROUTER_API_KEY) {
      throw new ApiError(503, "OPENROUTER_NOT_CONFIGURED", "OpenRouter generation is not configured yet.");
    }

    const model = input.model || env.OPENROUTER_MODEL;

    let response: Response;
    try {
      response = await fetch(`${env.OPENROUTER_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://bookbot.local",
          "X-Title": "BookBot"
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: 900,
          stream: true,
          messages: [
            { role: "system", content: STREAMING_RAG_SYSTEM_PROMPT },
            ...toHistoryMessages(input.history),
            { role: "user", content: buildUserPrompt(input.question, input.chunks) }
          ]
        })
      });
    } catch {
      yield* this.fallbackAnswer(input);
      return;
    }

    if (!response.ok || !response.body) {
      yield* this.fallbackAnswer(input);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) {
            continue;
          }

          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") {
            return;
          }

          try {
            const chunk = JSON.parse(payload) as OpenRouterStreamChunk;
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) {
              yield delta;
            }
          } catch {
            // Ignore keep-alive comments and partial frames.
          }
        }
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }
  }

  private async *fallbackAnswer(input: GenerateAnswerInput): AsyncGenerator<string> {
    const result = await this.generateAnswer(input);
    yield result.answer;
  }
}
