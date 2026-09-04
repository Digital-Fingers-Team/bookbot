---
tags: [architecture, data]
---

# Data Model

Mongoose models in `apps/api/src/models/`.

## Book
Identity/source: `title`, `author`, `originalFileName`, `originalPdfPath`, `sourceFormat` (pdf|epub|docx|txt), `storageProvider`, `uploadChecksum`, `externalSourceId`.
Processing: `status` (processing|ready|failed|cancelled), `processedPages`, `pageCount`, `chunkCount`, `readyAt`, `error`, and the version stamps `chunkingVersion` (`v2`), `embeddingVersion`, `processingVersion` (`2026-06`).
Catalog: `category` (legacy single) **and** `categories` (array) — both are queried everywhere; `price` (default 0), `featured`, `description`.
Extras: Heyzine flipbook (`heyzineId`, `heyzineUrl`), summary audio fields, OMP push fields (`ompSubmissionId`, `ompPushStatus`, `ompPushedAt`, `ompPushError`).

> `price` may be **absent** on legacy documents — see [[Open Threads]].

## Chunk
`bookId`, `bookName`, `pageNumber`, `chunkIndex`, `chunkText`, `normalizedText`, `embedding`, `embeddingModel`, `embeddingDimensions`, `chunkingVersion`, `embeddingVersion`. The vector index lives in `apps/api/vector-indexes/`; `ATLAS_VECTOR_INDEX_NAME` selects it and `VECTOR_INDEX_HAS_BOOK_FILTER` says whether it supports a bookId filter.

## User
`name`, `email` (unique), `passwordHash` (`select:false`), `role` (admin|org_admin|user), `language` (en|ar), `organizationId`, grants `allowedBookIds` / `allowedCategories` / `allowedDownloadBookIds`, OMP link (`ompUserId`, `ompUsername`, `ompPasswordEnc` encrypted via `utils/secret-box`, `ompLinkedAt`).

## Organization
`name`, `allowedBookIds`, `allowedCategories`, `downloadableBookIds`, `bookQuotas` (mixed map — per-book seat quota), network policy (`networkRestrictionEnabled`, `allowedIpCidrs`, `lastObservedIp`, `networkPolicyUpdatedAt/By`).

## Others
`book-page` (rendered page text), `book-state` (per-user progress/favorites), `category`, `conversation`, `access-request`, `feedback`, `notification`, `usage-event`.

Related: [[Domain/Access Control]] · [[Architecture/RAG Pipeline]]
