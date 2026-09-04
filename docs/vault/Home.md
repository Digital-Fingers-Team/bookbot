---
tags: [moc]
updated: 2026-09-05
---

# AradoBot — Vault Home

Knowledge base for the AradoBot monorepo, so a new chat can be brought up to speed by reading a few notes instead of re-reading the codebase.

**What it is:** an AI book-knowledge SaaS for ARADO. Books (PDF/EPUB/DOCX/TXT) are ingested, chunked, embedded into MongoDB, and answered over with deterministic hybrid retrieval and page-cited evidence. Arabic-first RTL UI. Integrated with Open Monograph Press (OMP).

## Start here
- [[Repo Map]] — where everything lives
- [[Architecture/RAG Pipeline|RAG Pipeline]] — upload → answer, end to end
- [[Domain/Access Control|Access Control]] — who can read what (the trickiest area)
- [[Operations/Environment|Environment]] — env vars and config surface

## Maps of content
| Area | Notes |
| --- | --- |
| Architecture | [[Architecture/RAG Pipeline\|RAG Pipeline]] · [[Architecture/API Surface\|API Surface]] · [[Architecture/Web App\|Web App]] · [[Architecture/Data Model\|Data Model]] |
| Domain | [[Domain/Access Control\|Access Control]] · [[Domain/Organizations\|Organizations]] · [[Domain/OMP Integration\|OMP Integration]] |
| Operations | [[Operations/Environment\|Environment]] · [[Operations/Local Development\|Local Development]] · [[Operations/Deployment\|Deployment]] · [[Operations/Testing\|Testing]] |
| Working notes | [[Open Threads]] · [[Conventions]] · [[Decisions]] |

## Fast facts
- pnpm 10.34.3 workspace, Node ≥ 20.20.0; apps: `@aradobot/api` (Express) and `@aradobot/web` (Next.js).
- MongoDB with Atlas Search + Vector Search (local dev uses `mongodb/mongodb-atlas-local`).
- LLM + embeddings through OpenRouter by default; a local OpenAI-compatible provider is supported.
- Roles: `admin`, `org_admin`, `user`.
