import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { UsageEvent } from "../models/usage-event.model.js";
import { buildSources, normalizeModelAnswer } from "../services/generation/citation.service.js";
import { generateAnswer } from "../services/generation/openrouter.service.js";
import { retrieveRelevantChunks } from "../services/retrieval/retrieval.service.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";

const chatSchema = z.object({
  question: z.string().trim().min(1, "Question is required.").max(2000),
  limit: z.number().int().min(5).max(15).optional(),
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

    const chunks = await retrieveRelevantChunks(parsed.data.question, parsed.data.limit);

    if (!chunks.length) {
      await UsageEvent.create({
        type: "chat",
        status: "success",
        latencyMs: Date.now() - startedAt,
        chunkCount: 0
      });

      res.json({
        answer: "Answer: Information not found in the uploaded books.",
        sources: [],
        evidence: [],
        usage: {
          retrievedChunks: 0
        }
      });
      return;
    }

    const generation = await generateAnswer({
      question: parsed.data.question,
      chunks,
      model: parsed.data.model
    });

    await UsageEvent.create({
      type: "chat",
      status: "success",
      model: generation.model,
      chunkCount: chunks.length,
      latencyMs: Date.now() - startedAt,
      promptTokens: generation.usage.promptTokens,
      completionTokens: generation.usage.completionTokens,
      totalTokens: generation.usage.totalTokens
    });

    res.json({
      answer: normalizeModelAnswer(generation.content),
      sources: buildSources(chunks),
      evidence: chunks,
      usage: {
        model: generation.model,
        retrievedChunks: chunks.length,
        ...generation.usage
      }
    });
  })
);
