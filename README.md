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

## RAG Boundary

The generation layer only receives the user question and the top retrieved chunks. It never receives the full database or unretrieved book content.
