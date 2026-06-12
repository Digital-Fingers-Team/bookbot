# BookBotD

Production-ready AI book knowledge SaaS architecture for PDF ingestion, deterministic hybrid retrieval, and strict RAG generation through OpenRouter.

## Apps

- `apps/api` - Express, MongoDB, Mongoose, pdf-parse, Fuse.js, OpenRouter.
- `apps/web` - Next.js, React, Tailwind CSS.

## Quick Start

This repo is pinned to `pnpm@11.4.0` and requires Node.js 22.13 or newer.

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Run MongoDB locally or update `MONGODB_URI`. The API defaults to port `4000`; the web app defaults to port `3000`.

## Environment

- `MONGODB_URI` - MongoDB connection string.
- `OPENROUTER_API_KEY` - OpenRouter API key.
- `OPENROUTER_MODEL` - Default model ID.
- `ADMIN_API_KEY` - Optional single-tenant admin key for upload/delete/stats.
- `CLIENT_ORIGIN` - CORS origin for the frontend.
- `NEXT_PUBLIC_API_URL` - Browser-facing API URL.

## RAG Boundary

The generation layer only receives the user question and the top retrieved chunks. It never receives the full database or unretrieved book content.
