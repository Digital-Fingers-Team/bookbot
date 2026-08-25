import type { GenerateAnswerInput, GenerateAnswerResult } from "../../../types/rag.js";
import { ApiError } from "../../../utils/api-error.js";
import { parseAnswerOnlyJson } from "../answer-parser.service.js";
import { buildUserPrompt, getSystemPrompt } from "../prompt.service.js";
import type { LLMProvider } from "../llm-provider.service.js";
import type { LLMSettings } from "../../../config/llm.js";

type ChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

type StreamChunk = { choices?: Array<{ delta?: { content?: string } }> };

function toHistoryMessages(history?: GenerateAnswerInput["history"]) {
  return (history ?? [])
    .filter((turn) => turn.content?.trim())
    .slice(-6)
    .map((turn) => ({ role: turn.role, content: turn.content }));
}

export class OpenAICompatibleProvider implements LLMProvider {
  constructor(private readonly settings: LLMSettings) {}

  async generateAnswer(input: GenerateAnswerInput): Promise<GenerateAnswerResult> {
    this.assertConfigured();
    const model = input.model || this.settings.model;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const body: Record<string, unknown> = {
        model,
        temperature: 0.2,
        max_tokens: 900,
        messages: [
          { role: "system", content: getSystemPrompt(false, input.allowOutsideBook, input.quiz) },
          ...toHistoryMessages(input.history),
          { role: "user", content: buildUserPrompt(input.question, input.chunks, input.allowOutsideBook, input.quiz) }
        ]
      };
      if (this.settings.jsonMode && !input.quiz) {
        body.response_format = { type: "json_object" };
      }

      const response = await fetch(`${this.settings.baseUrl}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: this.headers(),
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        console.error(`${this.settings.name} API error: ${response.status} ${response.statusText}`, await response.text());
        throw new ApiError(502, `${this.settings.name.toUpperCase().replace(/ /g, "_")}_FAILURE`, `The ${this.settings.name} could not complete the answer right now.`);
      }

      const payload = (await response.json()) as ChatResponse;
      const content = payload.choices?.[0]?.message?.content?.trim();
      if (!content) {
        throw new ApiError(502, "EMPTY_AI_RESPONSE", `The ${this.settings.name} returned an empty answer.`);
      }

      return {
        answer: this.parseAnswer(content, input.quiz),
        model,
        usage: {
          promptTokens: payload.usage?.prompt_tokens,
          completionTokens: payload.usage?.completion_tokens,
          totalTokens: payload.usage?.total_tokens
        }
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(502, "LLM_PROVIDER_FAILURE", `The ${this.settings.name} could not complete the answer right now.`);
    } finally {
      clearTimeout(timeout);
    }
  }

  async *streamAnswer(input: GenerateAnswerInput): AsyncGenerator<string> {
    this.assertConfigured();
    const model = input.model || this.settings.model;
    let response: Response;

    try {
      response = await fetch(`${this.settings.baseUrl}/chat/completions`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: 900,
          stream: true,
          messages: [
            { role: "system", content: getSystemPrompt(true, input.allowOutsideBook, input.quiz) },
            ...toHistoryMessages(input.history),
            { role: "user", content: buildUserPrompt(input.question, input.chunks, input.allowOutsideBook, input.quiz) }
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
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") return;
          try {
            const chunk = JSON.parse(payload) as StreamChunk;
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) yield delta;
          } catch {
            // Ignore keep-alives and incomplete SSE frames.
          }
        }
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }
  }

  private headers(): HeadersInit {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.settings.apiKey) headers.Authorization = `Bearer ${this.settings.apiKey}`;
    if (this.settings.name === "OpenRouter") {
      headers["HTTP-Referer"] = "https://aradobot.local";
      headers["X-Title"] = "AradoBot";
    }
    return headers;
  }

  private parseAnswer(content: string, quiz?: GenerateAnswerInput["quiz"]): string {
    if (quiz) return content;
    if (this.settings.jsonMode) {
      return parseAnswerOnlyJson(content);
    }
    try {
      return parseAnswerOnlyJson(content);
    } catch {
      // A local server may ignore the JSON instruction when JSON_MODE is false.
      // Keep its plain-text answer usable instead of exposing a parser error.
      return content;
    }
  }

  private assertConfigured() {
    if (this.settings.requiresApiKey && !this.settings.apiKey) {
      throw new ApiError(503, "OPENROUTER_NOT_CONFIGURED", "OpenRouter generation is not configured yet.");
    }
  }

  private async *fallbackAnswer(input: GenerateAnswerInput): AsyncGenerator<string> {
    const result = await this.generateAnswer(input);
    yield result.answer;
  }
}
