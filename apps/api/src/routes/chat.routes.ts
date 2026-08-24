import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { getConfiguredLLMModel } from "../config/llm.js";
import { UsageEvent } from "../models/usage-event.model.js";
import { createLLMProvider } from "../services/generation/llm-provider.service.js";
import { buildEvidenceBooks, buildStructuredSources } from "../services/retrieval/evidence.service.js";
import { retrieveRelevantChunks } from "../services/retrieval/retrieval.service.js";
import { allowedBookIdList, resolveAccessScope } from "../services/access/access.service.js";
import { discoverBooks } from "../services/discovery/discovery.service.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";

const NOT_FOUND_ANSWER = "I couldn't find this information in the books.";

// The prompt instructs the model to prefix "not found" answers with this
// token so we can strip book references from them even when retrieval did
// return (irrelevant) chunks — the app must never cite pages for an answer
// it admits it couldn't find.
const NOT_FOUND_PREFIX = "NOT_FOUND:";

function extractNotFound(rawAnswer: string): { answer: string; notFound: boolean } {
  const trimmed = rawAnswer.trimStart();
  if (trimmed.slice(0, NOT_FOUND_PREFIX.length).toUpperCase() === NOT_FOUND_PREFIX) {
    return { answer: trimmed.slice(NOT_FOUND_PREFIX.length).trimStart(), notFound: true };
  }
  return { answer: rawAnswer, notFound: false };
}

const chatSchema = z.object({
  question: z.string().trim().min(1, "Question is required.").max(2000),
  topK: z.number().int().min(1).max(75).optional(),
  limit: z.number().int().min(1).max(75).optional(),
  knownChunkIds: z.array(z.string().trim().min(1)).max(200).optional(),
  previousAnswer: z.string().trim().max(8000).optional(),
  provider: z.enum(["openrouter", "local"]).optional(),
  model: z.string().trim().min(3).max(120).optional(),
  // Scope retrieval to a single book ("ask within this book").
  bookId: z.string().trim().min(1).max(64).optional(),
  // Recent turns so follow-up questions can resolve context.
  allowOutsideBook: z.boolean().optional(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().max(8000) }))
    .max(20)
    .optional()
});

// For follow-ups, fold the previous question into the retrieval query so a
// contextual question ("وما الفرق بينهما؟") still finds the right chunks.
function buildRetrievalQuery(question: string, history?: { role: string; content: string }[]) {
  const lastUser = history?.filter((turn) => turn.role === "user").at(-1)?.content?.trim();
  return lastUser ? `${lastUser} ${question}` : question;
}

const discoverSchema = z.object({
  question: z.string().trim().min(1, "Question is required.").max(2000)
});

export const chatRouter: ExpressRouter = Router();

// Discovery: recommend books from catalog metadata only (title/category/
// description). Available to any signed-in user — no access required, no
// content returned — so newcomers can decide what to request access to.
chatRouter.post(
  "/discover",
  asyncHandler(async (req, res) => {
    const parsed = discoverSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "INVALID_DISCOVERY_REQUEST", "Please enter a valid question.", parsed.error.flatten());
    }
    const result = await discoverBooks(parsed.data.question, req.user?.language ?? "ar");
    res.json(result);
  })
);

chatRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const startedAt = Date.now();
    const parsed = chatSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ApiError(400, "INVALID_CHAT_REQUEST", "Please enter a valid question.", parsed.error.flatten());
    }

    const topK = parsed.data.topK ?? parsed.data.limit ?? 15;
    const scope = await resolveAccessScope(req.user!);
    const retrievalQuery = buildRetrievalQuery(parsed.data.question, parsed.data.history);
    const retrieval = await retrieveRelevantChunks(retrievalQuery, topK, undefined, parsed.data.bookId, allowedBookIdList(scope));
    const chunks = retrieval.chunks;
    const books = buildEvidenceBooks(chunks);
    const sources = buildStructuredSources(books);

    if (!chunks.length && !parsed.data.allowOutsideBook) {
      await UsageEvent.create({
        type: "chat",
        status: "success",
        latencyMs: Date.now() - startedAt,
        chunkCount: 0,
        question: parsed.data.question.slice(0, 300),
        answered: false
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
          model: parsed.data.model,
          history: parsed.data.history,
          allowOutsideBook: parsed.data.allowOutsideBook
        });
    const generationUsage = generation.usage ?? {};
    const { answer: cleanAnswer, notFound } = extractNotFound(generation.answer);

    await UsageEvent.create({
      type: "chat",
      status: "success",
      model: generation.model,
      chunkCount: chunks.length,
      latencyMs: Date.now() - startedAt,
      question: parsed.data.question.slice(0, 300),
      answered: !notFound,
      promptTokens: generationUsage.promptTokens,
      completionTokens: generationUsage.completionTokens,
      totalTokens: generationUsage.totalTokens
    });

    res.json({
      answer: cleanAnswer,
      books: notFound ? [] : books,
      sources: notFound ? [] : sources,
      evidence: notFound ? [] : chunks,
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

  const model = parsed.data.model ?? getConfiguredLLMModel(parsed.data.provider);

  try {
    const topK = parsed.data.topK ?? parsed.data.limit ?? 15;
    const scope = await resolveAccessScope(req.user!);
    const retrievalQuery = buildRetrievalQuery(parsed.data.question, parsed.data.history);
    const retrieval = await retrieveRelevantChunks(retrievalQuery, topK, undefined, parsed.data.bookId, allowedBookIdList(scope));
    const chunks = retrieval.chunks;
    const books = buildEvidenceBooks(chunks);
    const sources = buildStructuredSources(books);

    send("meta", {
      books,
      sources,
      evidence: chunks,
      usage: { retrievedChunks: chunks.length, vectorCandidateCount: retrieval.vectorCandidateCount }
    });

    if (!chunks.length && !parsed.data.allowOutsideBook) {
      send("token", { delta: NOT_FOUND_ANSWER });
      send("done", { answer: NOT_FOUND_ANSWER, notFound: true, usage: { model, retrievedChunks: 0 } });
      await UsageEvent.create({
        type: "chat",
        status: "success",
        latencyMs: Date.now() - startedAt,
        chunkCount: 0,
        question: parsed.data.question.slice(0, 300),
        answered: false
      });
      res.end();
      return;
    }

    const provider = createLLMProvider(parsed.data.provider);
    let answer = "";
    let notFound = false;

    // Sources were already sent in the "meta" event above (for a live feel),
    // before we know whether the model will actually find an answer. If the
    // stream turns out to start with the NOT_FOUND sentinel, correct that
    // earlier event by re-sending "meta" with everything cleared, and strip
    // the sentinel out of what reaches the client.
    const clearMetaForNotFound = () => {
      notFound = true;
      send("meta", {
        books: [],
        sources: [],
        evidence: [],
        usage: { retrievedChunks: 0, vectorCandidateCount: retrieval.vectorCandidateCount }
      });
    };

    let pendingBuffer = "";
    let prefixChecked = false;
    const forwardChecked = (text: string) => {
      if (!text) {
        return;
      }
      answer += text;
      send("token", { delta: text });
    };
    const checkPrefix = (final: boolean) => {
      if (prefixChecked) {
        return;
      }
      if (!final && pendingBuffer.length < NOT_FOUND_PREFIX.length) {
        return;
      }
      prefixChecked = true;
      if (pendingBuffer.slice(0, NOT_FOUND_PREFIX.length).toUpperCase() === NOT_FOUND_PREFIX) {
        clearMetaForNotFound();
        pendingBuffer = pendingBuffer.slice(NOT_FOUND_PREFIX.length).trimStart();
      }
      forwardChecked(pendingBuffer);
      pendingBuffer = "";
    };

    if (provider.streamAnswer) {
      for await (const delta of provider.streamAnswer({
        question: parsed.data.question,
        chunks,
        model: parsed.data.model,
        history: parsed.data.history,
        allowOutsideBook: parsed.data.allowOutsideBook
      })) {
        if (aborted) {
          break;
        }
        if (prefixChecked) {
          forwardChecked(delta);
        } else {
          pendingBuffer += delta;
          checkPrefix(false);
        }
      }
      checkPrefix(true);
    } else {
      const generated = await provider.generateAnswer({
        question: parsed.data.question,
        chunks,
        model: parsed.data.model,
        history: parsed.data.history,
        allowOutsideBook: parsed.data.allowOutsideBook
      });
      pendingBuffer = generated.answer;
      checkPrefix(true);
    }

    send("done", {
      answer,
      notFound,
      usage: { model, retrievedChunks: chunks.length, vectorCandidateCount: retrieval.vectorCandidateCount }
    });

    if (!aborted) {
      await UsageEvent.create({
        type: "chat",
        status: "success",
        model,
        chunkCount: chunks.length,
        latencyMs: Date.now() - startedAt,
        question: parsed.data.question.slice(0, 300),
        answered: !notFound
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
