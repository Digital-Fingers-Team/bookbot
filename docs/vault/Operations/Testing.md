---
tags: [ops, testing]
---

# Testing & CI

```bash
pnpm typecheck   # api + web
pnpm test        # api + web
pnpm build
```

CI: `.github/workflows/ci.yml`.

API tests (`apps/api/tests/`) and what they pin down:
- `access-scope.test.ts`, `network-policy.test.ts` → [[Domain/Access Control]]
- `retrieval-scoring.test.ts`, `retrieval-vector.test.ts`, `reranker.test.ts`, `toc.test.ts` → [[Architecture/RAG Pipeline]] retrieval
- `chunker.test.ts`, `text-quality.test.ts`, `pdf-storage.test.ts` → ingestion
- `embedding.test.ts`, `provider.test.ts`, `prompt.test.ts`, `citation.test.ts`, `quiz.test.ts` → generation
- `chat-route.test.ts`, `excel-book-import.test.ts`, `file-name.test.ts` → routes/utils

When touching retrieval or access, run these before anything else — they are the regression net for the two areas with the most subtle rules.
