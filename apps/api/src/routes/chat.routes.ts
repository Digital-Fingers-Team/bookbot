import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { UsageEvent } from "../models/usage-event.model.js";
import { createLLMProvider } from "../services/generation/llm-provider.service.js";
import { buildEvidenceBooks, buildStructuredSources } from "../services/retrieval/evidence.service.js";
import { retrieveRelevantChunks } from "../services/retrieval/retrieval.service.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";

const NOT_FOUND_ANSWER = "I couldn't find this information in the books.";

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

// Server-Sent Events: emit retrieved evidence immediately, then stream the
// answer token by token so the UI feels live (like a chat assistant).
chatRouter.post("/stream", async (req, res) => {
  const startedAt = Date.now();
  const parsed = chatSchema.safeParse(req.body);

  if (!parsed.success) {
    res
      .status(400)
      .json({ error: { code: "INVALID_CHAT_REQUEST", message: "Please enter a valid question." } });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  let aborted = false;
  req.on("close", () => {
    aborted = true;
  });

  const model = parsed.data.model ?? env.OPENROUTER_MODEL;

  try {
    const topK = parsed.data.topK ?? parsed.data.limit ?? 15;
    const retrieval = await retrieveRelevantChunks(parsed.data.question, topK);
    const chunks = retrieval.chunks;
    const books = buildEvidenceBooks(chunks);
    const sources = buildStructuredSources(books);

    send("meta", {
      books,
      sources,
      evidence: chunks,
      usage: { retrievedChunks: chunks.length, vectorCandidateCount: retrieval.vectorCandidateCount }
    });

    if (!chunks.length) {
      send("token", { delta: NOT_FOUND_ANSWER });
      send("done", { answer: NOT_FOUND_ANSWER, usage: { model, retrievedChunks: 0 } });
      await UsageEvent.create({ type: "chat", status: "success", latencyMs: Date.now() - startedAt, chunkCount: 0 });
      res.end();
      return;
    }

    const provider = createLLMProvider(parsed.data.provider);
    let answer = "";

    if (provider.streamAnswer) {
      for await (const delta of provider.streamAnswer({ question: parsed.data.question, chunks, model: parsed.data.model })) {
        if (aborted) {
          break;
        }
        answer += delta;
        send("token", { delta });
      }
    } else {
      const generated = await provider.generateAnswer({ question: parsed.data.question, chunks, model: parsed.data.model });
      answer = generated.answer;
      send("token", { delta: answer });
    }

    send("done", {
      answer,
      usage: { model, retrievedChunks: chunks.length, vectorCandidateCount: retrieval.vectorCandidateCount }
    });

    if (!aborted) {
      await UsageEvent.create({
        type: "chat",
        status: "success",
        model,
        chunkCount: chunks.length,
        latencyMs: Date.now() - startedAt
      });
    }

    res.end();
  } catch (error) {
    const isApiError = error instanceof ApiError;
    send("error", {
      code: isApiError ? error.code : "CHAT_STREAM_FAILED",
      message: isApiError ? error.message : "The chat stream failed. Please try again."
    });
    await UsageEvent.create({ type: "chat", status: "failure", latencyMs: Date.now() - startedAt }).catch(
      () => undefined
    );
    res.end();
  }
});
