import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { UsageEvent } from "../models/usage-event.model.js";
import { createLLMProvider } from "../services/generation/llm-provider.service.js";
import { buildEvidenceBooks, buildStructuredSources } from "../services/retrieval/evidence.service.js";
import { retrieveRelevantChunks } from "../services/retrieval/retrieval.service.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";

const chatSchema = z.object({
  question: z.string().trim().min(1, "Question is required.").max(2000),
  topK: z.number().int().min(1).max(75).optional(),
  limit: z.number().int().min(1).max(75).optional(),
  knownChunkIds: z.array(z.string().trim().min(1)).max(200).optional(),
  previousAnswer: z.string().trim().max(8000).optional(),
  provider: z.enum(["openrouter"]).optional(),
  model: z.string().trim().min(3).max(120).optional()
});

export const chatRouter: ExpressRouter = Router();

chatRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const startedAt = Date.now();
    const parsed = chatSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ApiError(400, "INVALID_CHAT_REQUEST", "Please enter a valid question.", parsed.error.flatten());
    }

    const topK = parsed.data.topK ?? parsed.data.limit ?? 15;
    const retrieval = await retrieveRelevantChunks(parsed.data.question, topK);
    const chunks = retrieval.chunks;
    const books = buildEvidenceBooks(chunks);
    const sources = buildStructuredSources(books);

    if (!chunks.length) {
      await UsageEvent.create({
        type: "chat",
        status: "success",
        latencyMs: Date.now() - startedAt,
        chunkCount: 0
      });

      res.json({
        answer: "I couldn't find this information in the books.",
        books: [],
        sources: [],
        evidence: [],
        usage: {
          retrievedChunks: 0
        }
      });
      return;
    }

    const knownChunkIds = new Set(parsed.data.knownChunkIds ?? []);
    const hasNewChunks = chunks.some((chunk) => !knownChunkIds.has(chunk.id));
    const shouldReuseAnswer = parsed.data.previousAnswer && !hasNewChunks;
    const generation = shouldReuseAnswer
      ? {
          answer: parsed.data.previousAnswer as string,
          model: parsed.data.model,
          usage: {}
        }
      : await createLLMProvider(parsed.data.provider).generateAnswer({
          question: parsed.data.question,
          chunks,
          model: parsed.data.model
        });
    const generationUsage = generation.usage ?? {};

    await UsageEvent.create({
      type: "chat",
      status: "success",
      model: generation.model,
      chunkCount: chunks.length,
      latencyMs: Date.now() - startedAt,
      promptTokens: generationUsage.promptTokens,
      completionTokens: generationUsage.completionTokens,
      totalTokens: generationUsage.totalTokens
    });

    res.json({
      answer: generation.answer,
      books,
      sources,
      evidence: chunks,
      usage: {
        model: generation.model,
        retrievedChunks: chunks.length,
        vectorCandidateCount: retrieval.vectorCandidateCount,
        reusedAnswer: Boolean(shouldReuseAnswer),
        ...generationUsage
      }
    });
  })
);
