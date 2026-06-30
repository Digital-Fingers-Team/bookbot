import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/models/usage-event.model.js", () => ({
  UsageEvent: {
    create: vi.fn(async () => ({}))
  }
}));

vi.mock("../src/services/retrieval/retrieval.service.js", () => ({
  retrieveRelevantChunks: vi.fn(async () => ({
    chunks: [],
    vectorCandidateCount: 0
  }))
}));

// The chat route resolves the caller's access scope; stub it to "all" so the
// test can exercise the no-evidence path without a database.
vi.mock("../src/services/access/access.service.js", () => ({
  resolveAccessScope: vi.fn(async () => ({ all: true })),
  allowedBookIdList: vi.fn(() => null)
}));

describe("chat route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns legacy evidence array on no-evidence responses", async () => {
    const { chatRouter } = await import("../src/routes/chat.routes.js");
    const app = express();
    app.use(express.json());
    // The real app mounts chatRouter behind requireAuth; emulate an authed user.
    app.use((req, _res, next) => {
      (req as express.Request & { user: unknown }).user = {
        id: "u1",
        role: "admin",
        name: "Admin",
        email: "admin@example.com",
        language: "ar",
        hasAccess: true
      };
      next();
    });
    app.use("/api/chat", chatRouter);

    const server = app.listen(0);
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Could not start test server.");
    }

    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: "missing detail", topK: 1 })
      });
      const payload = (await response.json()) as { evidence?: unknown[]; books?: unknown[]; sources?: unknown[] };

      expect(response.status).toBe(200);
      expect(payload.evidence).toEqual([]);
      expect(payload.books).toEqual([]);
      expect(payload.sources).toEqual([]);
    } finally {
      server.close();
    }
  });
});
