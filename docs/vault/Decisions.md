---
tags: [adr]
---

# Decisions

Standing choices worth not re-arguing.

- **Narrow generation boundary.** The LLM receives only the question and the retrieved chunks. No full-book or full-DB context, ever. → [[Architecture/RAG Pipeline]]
- **Deterministic hybrid retrieval.** Vector search plus lexical reranking, not a pure vector top-k, so results are reproducible and testable.
- **Access resolved in one place.** `resolveAccessScope` is the only definition of "may read"; routes and retrieval both take its output. → [[Domain/Access Control]]
- **Downloads default closed** and are granted per book, independent of read access.
- **Free books are readable without a grant**, with "missing price" treated as free for legacy documents.
- **Payment lives outside the system** for organizations; the app models seats/quota only. → [[Domain/Organizations]]
- **Reprocessing is version-stamped** (`chunkingVersion` / `embeddingVersion` / `processingVersion`) rather than done in place.
- **Provider-swappable LLM and embeddings** — OpenRouter by default, any OpenAI-compatible local endpoint via `LOCAL_*` env.
