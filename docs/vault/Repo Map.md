---
tags: [map]
---

# Repo Map

```text
apps/api/    Express API, ingestion, retrieval, auth, integrations
apps/web/    Next.js app (App Router), Arabic-first RTL UI
omp/         Vendored Open Monograph Press (PHP) + Docker setup
scripts/     dev.mjs / start.mjs process runners, test-workbook generator
docker-compose.yml   MongoDB Atlas Local for development
deploy-patches/      Patches applied on the deploy target
```

## apps/api/src
| Folder | Contents |
| --- | --- |
| `config/` | `env.ts` (validated env), `database.ts`, `llm.ts`, `embedding.ts`, `rag.ts`, `logger.ts`, `sentry.ts` |
| `models/` | Mongoose schemas — see [[Architecture/Data Model]] |
| `routes/` | One router per resource — see [[Architecture/API Surface]] |
| `middleware/` | `auth`, `access`, `rate-limit`, `validate`, `error` |
| `services/` | `access`, `auth`, `discovery`, `embeddings`, `generation`, `import`, `ingestion`, `notifications`, `ocr`, `omp`, `retrieval`, `storage` |
| `scripts/` | one-off maintenance: `backfill-ready-at`, `check-vector-index`, `migrate-storage-to-gridfs`, `reclean-chunks` |
| `tests/` | Node test files — see [[Operations/Testing]] |
| `vector-indexes/` | Atlas vector index definitions |

## apps/web/src/app (routes)
`library`, `my-books`, `read`, `upload`, `users`, `organizations`, `org`, `requests`, `notifications`, `feedback`, `analytics`, `settings`, `login`, `register`.

Related: [[Home]]
