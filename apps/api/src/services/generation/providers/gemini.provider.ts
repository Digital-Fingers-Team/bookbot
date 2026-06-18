import { env } from "../../../config/env.js";
import type { GenerateAnswerInput, GenerateAnswerResult } from "../../../types/rag.js";
import { ApiError } from "../../../utils/api-error.js";
import { parseAnswerOnlyJson } from "../answer-parser.service.js";
import { buildUserPrompt, STRICT_RAG_SYSTEM_PROMPT } from "../prompt.service.js";
import type { LLMProvider } from "../llm-provider.service.js";

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  modelVersion?: string;
};

export class GeminiProvider implements LLMProvider {
  async generateAnswer(input: GenerateAnswerInput): Promise<GenerateAnswerResult> {
    if (!env.GEMINI_API_KEY) {
      throw new ApiError(503, "GEMINI_NOT_CONFIGURED", "Gemini generation is not configured yet.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    const model = input.model || env.GEMINI_MODEL;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`,
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: STRICT_RAG_SYSTEM_PROMPT }]
            },
            contents: [
              {
                role: "user",
                parts: [{ text: buildUserPrompt(input.question, input.chunks) }]
              }
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 700,
              responseMimeType: "application/json"
            }
          })
        }
      );

      if (!response.ok) {
        throw new ApiError(502, "GEMINI_FAILURE", "The AI provider could not complete the answer right now.");
      }

      const payload = (await response.json()) as GeminiResponse;
      const content = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
      if (!content) {
        throw new ApiError(502, "EMPTY_AI_RESPONSE", "The AI provider returned an empty answer.");
      }

      return {
        answer: parseAnswerOnlyJson(content),
        model: payload.modelVersion ?? model,
        usage: {
          promptTokens: payload.usageMetadata?.promptTokenCount,
          completionTokens: payload.usageMetadata?.candidatesTokenCount,
          totalTokens: payload.usageMetadata?.totalTokenCount
        }
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(502, "GEMINI_FAILURE", "The AI provider could not complete the answer right now.");
    } finally {
      clearTimeout(timeout);
    }
  }
}
