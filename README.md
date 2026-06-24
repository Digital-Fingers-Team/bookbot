# BookBot

Production-ready AI book knowledge SaaS architecture for PDF ingestion, deterministic hybrid retrieval, and strict RAG generation through OpenRouter.

## Apps

- `apps/api` - Express, MongoDB, Mongoose, pdf-parse, Fuse.js, OpenRouter.
- `apps/web` - Next.js, React, Tailwind CSS.

## Quick Start

This repo is pinned to `pnpm@10.34.3` and supports Node.js 20.20.0 or newer. Railpack is configured for Node 20 so managed builders do not try to run pnpm 11 on Node 20.

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Run MongoDB locally or update `MONGODB_URI`. The API defaults to port `4000`; the web app defaults to port `3000`.

If the API says MongoDB is not reachable, start a database first:

```bash
docker compose up -d mongo
pnpm dev
```

If you do not want Docker, install MongoDB locally on Windows or use MongoDB Atlas and put its connection string in `MONGODB_URI`.

## Environment

- `MONGODB_URI` - MongoDB connection string.
- `OPENROUTER_API_KEY` - OpenRouter API key.
- `OPENROUTER_MODEL` - Default model ID.
- `AUTH_JWT_SECRET` - Secret used to sign BookBot login sessions.
- `DEFAULT_ADMIN_EMAIL` - Seeded admin email, defaults to `admin@example.com`.
- `DEFAULT_ADMIN_PASSWORD` - Seeded admin password, defaults to `admin123`.
- `ADMIN_API_KEY` - Optional API-only fallback key for upload/delete/stats automation.
- `CLIENT_ORIGIN` - CORS origin for the frontend.
- `NEXT_PUBLIC_API_URL` - Browser-facing API URL.

## Ingestion & OCR

Uploads are processed in the background: the API stores the PDF, creates the book as `processing`, and returns immediately while extraction runs (the Library shows live progress and marks the book `ready` or `failed`).

Each page is read with fast text extractors (pdfjs + pdf-parse) and scored. Many Arabic books ship with broken embedded-font encodings — the page renders fine on screen but every text extractor returns garbage (scrambled letters, kashida decoded as repeated `ك`). When a page's text-quality score is below `OCR_MIN_TEXT_SCORE`, the page is rendered to an image and transcribed by OCR, which reads the pixels instead of the corrupt character codes.

Two OCR engines are supported via `OCR_PROVIDER`:

- `auto` (default) - uses the OpenRouter vision model (best Arabic quality), and **automatically falls back to local OCR when the account has no key or runs out of credits**.
- `openrouter` - cloud vision model only.
- `local` - offline [tesseract.js](https://github.com/naptha/tesseract.js) only. Free, no API key, runs on CPU; rougher quality but far better than a broken text layer. Language models are downloaded once and cached in `.tesseract-cache`.

OCR settings (all optional, sensible defaults):

- `OCR_ENABLED` - turn the OCR fallback on/off (default `true`).
- `OCR_PROVIDER` - `auto` | `openrouter` | `local` (default `auto`).
- `OCR_LOCAL_LANGS` - tesseract languages for local OCR (default `ara+eng`).
- `OCR_VISION_MODEL` - OpenRouter vision model, default `google/gemini-2.5-flash`.
- `OCR_MIN_TEXT_SCORE` - pages scoring below this are sent to OCR (default `65`).
- `OCR_RENDER_SCALE` - page raster scale; higher is sharper but slower (default `2`).
- `OCR_MAX_PAGES` - cap on OCR pages per book (default `600`).
- `OCR_CONCURRENCY` - global cap on OCR pages in flight at once across all books (default `6`). Raise it for faster cloud OCR; for local OCR it is also bounded by CPU cores.
- `PROCESSING_CONCURRENCY` - how many books are processed at the same time (default `2`).
- `OCR_MAX_OUTPUT_TOKENS` - max tokens per OCR response (default `4096`).

Processing is parallel at three levels: multiple books at once (`PROCESSING_CONCURRENCY`), concurrent per-page text extraction within a book, and concurrent OCR bounded globally by `OCR_CONCURRENCY`. The global OCR limit means adding more books never overwhelms the provider or CPU.

OCR uses the same `OPENROUTER_API_KEY`; large scanned/broken books cost per page and take a few minutes.

## RAG Boundary

The generation layer only receives the user question and the top retrieved chunks. It never receives the full database or unretrieved book content.
