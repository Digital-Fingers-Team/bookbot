import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/models/usage-event.model.js", () => ({
  UsageEvent: { create: vi.fn(async () => ({})) }
}));

vi.mock("../src/services/access/access.service.js", () => ({
  resolveAccessScope: vi.fn(async () => ({ all: true })),
  allowedBookIdList: vi.fn(() => null)
}));

// Retrieval always returns a usable excerpt, so any missing citation in the
// response is the route's decision rather than an empty retrieval.
vi.mock("../src/services/retrieval/chat-retrieval.service.js", () => ({
  retrieveChatChunks: vi.fn(async () => ({
    retrieval: {
      chunks: [
        {
          id: "c1",
          bookId: "b1",
          bookName: "إدارة المعرفة",
          pageNumber: 68,
          chunkText: "Knowledge management supports competitive advantage.",
          score: 60,
          highlights: []
        }
      ],
      vectorCandidateCount: 1
    },
    quiz: undefined
  }))
}));

const answerMock = vi.fn();
vi.mock("../src/services/generation/llm-provider.service.js", () => ({
  createLLMProvider: () => ({ generateAnswer: answerMock })
}));

interface ChatPayload {
  answer: string;
  books: unknown[];
  sources: unknown[];
  evidence: unknown[];
}

async function ask(body: Record<string, unknown>): Promise<ChatPayload> {
  const { chatRouter } = await import("../src/routes/chat.routes.js");
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as express.Request & { user: unknown }).user = {
      id: "u1",
      role: "admin",
      name: "Admin",
      email: "admin@example.com",
      language: "ar",
      adminPermissions: [],
      hasAccess: true
    };
    next();
  });
  app.use("/api/chat", chatRouter);

  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not start test server.");
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    expect(response.status).toBe(200);
    return (await response.json()) as ChatPayload;
  } finally {
    server.close();
  }
}

describe("book citations follow what actually grounded the answer", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("cites pages for an answer drawn from the book", async () => {
    answerMock.mockResolvedValue({ answer: "إدارة المعرفة تدعم التفوق التنافسي.", usage: {} });
    const payload = await ask({ question: "ما هي إدارة المعرفة؟" });

    expect(payload.sources).toHaveLength(1);
    expect(payload.evidence).toHaveLength(1);
  });

  it("drops citations for an outside-the-book answer the excerpts did not support", async () => {
    // What the model returns once it has been asked to go beyond the book and
    // the excerpts contributed nothing.
    answerMock.mockResolvedValue({
      answer: "NO_BOOK_SOURCE: مهارات القيادة الإدارية تشمل التخطيط والتنظيم.",
      usage: {}
    });
    const payload = await ask({ question: "مهارات القيادة الادارية؟", allowOutsideBook: true });

    expect(payload.answer).toBe("مهارات القيادة الإدارية تشمل التخطيط والتنظيم.");
    expect(payload.sources).toEqual([]);
    expect(payload.books).toEqual([]);
    expect(payload.evidence).toEqual([]);
  });

  it("still drops citations when nothing was found at all", async () => {
    answerMock.mockResolvedValue({ answer: "NOT_FOUND: لا تغطي الكتب هذا الموضوع.", usage: {} });
    const payload = await ask({ question: "مهارات القيادة الادارية؟" });

    expect(payload.answer).toBe("لا تغطي الكتب هذا الموضوع.");
    expect(payload.sources).toEqual([]);
  });
});
