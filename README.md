# AradoBot

AI-powered book discovery and reading for the Arab Administrative Development Organization (ARADO). AradoBot turns uploaded books into a searchable knowledge library, then answers questions with cited evidence from the user’s permitted books.

[![CI](https://github.com/Digital-Fingers-Team/bookbot/actions/workflows/ci.yml/badge.svg)](https://github.com/Digital-Fingers-Team/bookbot/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)

## What it does

- Ingests PDF, EPUB, DOCX, and TXT books in the background.
- Extracts, cleans, chunks, and embeds book content for retrieval.
- Uses deterministic hybrid retrieval with vector search and lexical reranking.
- Generates answers from retrieved passages only, with page-aware evidence and citations.
- Detects low-quality PDF text layers and falls back to cloud vision OCR or local Tesseract OCR.
- Provides Arabic-first, right-to-left UI with English support and theme switching.
- Supports book discovery, reading progress, favorites, quizzes, conversations, and summary audio.
- Includes admin tools for uploads, users, organizations, access requests, feedback, and analytics.
- Integrates with Open Monograph Press (OMP) for catalog discovery, author accounts, SSO links, and submission workflows.

## How it works

`mermaid
flowchart LR
    A[Book upload] --> B[Background processing]
    B --> C[Text extraction and OCR]
    C --> D[Cleaning and chunking]
    D --> E[Embeddings in MongoDB]
    Q[User question] --> F[Access-scoped retrieval]
    E --> F
    F --> G[LLM receives question and top chunks]
    G --> H[Answer with evidence and citations]
`

The generation boundary is intentionally narrow: the model receives the question and retrieved chunks, never the full database or unretrieved book content.

## Repository layout

`text
.
├── apps/
│   ├── api/             Express API, ingestion pipeline, retrieval, auth, and integrations
│   └── web/             Next.js application and user interface
├── scripts/             Monorepo development and production process runners
├── docker-compose.yml   MongoDB Atlas Local for development
├── .env.example         Environment variable template
└── .github/workflows/   Continuous integration
`

## Requirements

- Node.js `20.20.0` or newer
- pnpm `10.34.3` (the repository is pinned to this version)
- MongoDB with Search and Vector Search support
- OpenRouter API key, unless you configure a compatible local LLM and embedding provider
- Docker Desktop is recommended for local MongoDB development

## Quick start

### 1. Install dependencies

`bash
pnpm install
`

### 2. Create your environment file

macOS/Linux:

`bash
cp .env.example .env
`

PowerShell:

`powershell
Copy-Item .env.example .env
`

At minimum, review `MONGODB_URI`, `AUTH_JWT_SECRET`, `OPENROUTER_API_KEY`, `CLIENT_ORIGIN`, and `NEXT_PUBLIC_API_URL`. Change the seeded admin password before using a shared or production environment.

### 3. Start MongoDB

The included Compose file runs MongoDB Atlas Local, including the services needed for vector search:

`bash
docker compose up -d mongo
`

You can use MongoDB Atlas instead by setting `MONGODB_URI` to your Atlas connection string.

### 4. Create the vector index

Connect with `mongosh`, select the `aradobotd` database, and create the index once:

`javascript
db.chunks.createSearchIndex(
  "chunk_embedding_vector_index",
  "vectorSearch",
  {
    fields: [
      { type: "vector", path: "embedding", numDimensions: 1536, similarity: "cosine" }
    ]
  }
)
`

Verify the index from the repository root:

`bash
pnpm --filter @aradobot/api check:vector-index
`

The example index uses OpenRouter’s default 1,536-dimensional embeddings. If you switch to a local embedding model, create an index with the model’s dimensions and re-embed existing chunks.

### 5. Run the applications

`bash
pnpm dev
`

The web application is available at [http://localhost:3000](http://localhost:3000), and the API is available at [http://localhost:4000](http://localhost:4000). The API health endpoint is [http://localhost:4000/health](http://localhost:4000/health).

## Configuration

The complete, commented configuration is in [.env.example](.env.example). The main settings are grouped below.

| Area | Variables | Purpose |
| --- | --- | --- |
| Runtime | `NODE_ENV`, `PORT`, `TRUST_PROXY_HOPS`, `LOG_LEVEL`, `SENTRY_DSN` | API runtime, trusted proxy client-IP resolution, and optional error tracking |
| Database | `MONGODB_URI` | MongoDB connection string |
| Web/API | `CLIENT_ORIGIN`, `PUBLIC_API_URL`, `NEXT_PUBLIC_API_URL` | CORS, public API callbacks, and browser API access |
| Authentication | `AUTH_JWT_SECRET`, `DEFAULT_ADMIN_EMAIL`, `DEFAULT_ADMIN_PASSWORD`, `ADMIN_API_KEY` | Sessions, initial admin account, and optional automation access |
| AI generation | `LLM_PROVIDER`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `LOCAL_LLM_*` | Cloud or OpenAI-compatible local chat model |
| Embeddings | `EMBEDDING_PROVIDER`, `OPENROUTER_EMBEDDING_MODEL`, `LOCAL_EMBEDDING_*` | Vector representation used by retrieval |
| OCR | `OCR_ENABLED`, `OCR_PROVIDER`, `OCR_LOCAL_LANGS`, `OCR_VISION_MODEL` | OCR fallback for scanned or malformed PDFs |
| Storage | `STORAGE_DRIVER`, `STORAGE_LOCAL_DIR`, `PDF_STORAGE_DIR`, `S3_*` | Local disk, MongoDB GridFS, or S3-compatible object storage |
| Limits | `UPLOAD_MAX_MB`, `UPLOAD_MAX_FILES`, `OCR_MAX_PAGES`, `OCR_CONCURRENCY`, `PROCESSING_CONCURRENCY` | Upload, OCR, and processing safeguards |
| OMP | `OMP_BASE_URL`, `OMP_CONTEXT_PATH`, `OMP_API_TOKEN`, `OMP_USER_SECRET`, `OMP_SSO_SECRET` | Optional Open Monograph Press integration |

### AI providers

By default, chat and embeddings use OpenRouter. To run chat locally, configure an OpenAI-compatible server such as Ollama, LM Studio, or vLLM:

`dotenv
LLM_PROVIDER=local
LOCAL_LLM_BASE_URL=http://127.0.0.1:11434/v1
LOCAL_LLM_MODEL=qwen2.5:7b
`

Chat generation and embeddings are configured independently. Keep `EMBEDDING_PROVIDER=openrouter` unless you have created a matching local vector index and re-embedded the library.

### OCR

`OCR_PROVIDER=auto` uses the configured OpenRouter vision model and falls back to local Tesseract when the cloud provider is unavailable or out of credits. Use `OCR_PROVIDER=local` for an offline setup. Local OCR downloads and caches the `ara+eng` language data in `.tesseract-cache`.

OCR is triggered when extracted text falls below the configured quality threshold. Pages that remain below the final quality floor are excluded from chunking and retrieval rather than exposing likely-garbled evidence.

## Development commands

Run these commands from the repository root:

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the API and web applications in watch mode |
| `pnpm build` | Build both applications for production |
| `pnpm start` | Start both production builds |
| `pnpm typecheck` | Type-check the API and web applications |
| `pnpm test` | Run API and web test suites |
| `pnpm --filter @aradobot/api test` | Run API tests only |
| `pnpm --filter @aradobot/web test` | Run web tests only |
| `pnpm --filter @aradobot/api check:vector-index` | Check MongoDB vector index configuration |
| `pnpm --filter @aradobot/api reclean:chunks` | Reclean stored chunks after text-normalization changes |
| `pnpm --filter @aradobot/api backfill:ready-at` | Backfill readiness timestamps for existing books |
| `pnpm --filter @aradobot/api migrate:storage` | Migrate local blobs to GridFS |

## Production notes

- Set `NODE_ENV=production` and use long, unique values for `AUTH_JWT_SECRET`, `OMP_USER_SECRET`, and `OMP_SSO_SECRET`.
- Set `TRUST_PROXY_HOPS` to the actual number of trusted proxies in front of the API before enabling organization network restrictions; leave it at `0` for direct connections.
- Never use the example admin credentials or placeholder API keys in production.
- Set `CLIENT_ORIGIN` and `NEXT_PUBLIC_API_URL` to the deployed origins. `PUBLIC_API_URL` must be publicly reachable over HTTPS when Heyzine PDF conversion is enabled.
- Prefer `STORAGE_DRIVER=gridfs` or `STORAGE_DRIVER=s3` on deployments with ephemeral disks.
- Configure MongoDB Vector Search with the same embedding dimensions and similarity metric used by the active embedding provider.
- Keep upload and OCR concurrency within the capacity of the API host, MongoDB instance, and model provider.
- If enabled, configure OMP’s SSO shared secret to match `OMP_SSO_SECRET`.

The included [Railpack configuration](railpack.json) targets Node.js 20. The CI workflow runs dependency installation, type-checking, API tests, and a production build on pushes and pull requests to `main`.

## API surface

The API is mounted under `/api` and includes:

- `/api/auth` — registration, login, and session operations
- `/api/books` and `/api/categories` — catalog, reading, progress, and metadata
- `/api/upload` and `/api/excel-import` — admin ingestion workflows
- `/api/chat` and `/api/conversations` — book questions and saved conversations
- `/api/access-requests` — reader access requests and decisions
- `/api/organizations` and `/api/org-admin` — organization and student access management
- `/api/feedback`, `/api/notifications`, and `/api/stats` — operations and analytics
- `/api/omp` — Open Monograph Press integration

All protected routes enforce authentication and access scope in the API layer. Upload, feedback administration, user management, and organization administration have additional role checks.

## Testing

The test suite covers ingestion, text quality, OCR-related behavior, chunking, embeddings, vector retrieval, reranking, citations, access scoping, provider selection, API routes, and key web interactions.

Run the complete validation set before opening a pull request:

`bash
pnpm typecheck
pnpm test
pnpm build
`

## Contributing

1. Create a focused branch from `main`.
2. Keep changes scoped and add or update tests for behavioral changes.
3. Run type-checking, tests, and the production build locally.
4. Open a pull request with a concise description of the user-facing and operational impact.

Please do not commit `.env` files, credentials, private books, generated storage, or other sensitive data.
