---
tags: [ops, deploy]
---

# Deployment

- `railpack.json` and `omp/railway.json` — Railway-style build config.
- `deploy-oracle.bat` — deploy to the Oracle host; `ssh-key-2026-08-21.key` at the repo root is the key (never commit or share it).
- `deploy-patches/` — patches applied on the deploy target, e.g. `0001-topublicuser-promise.patch`.
- Build: `pnpm build` (api tsc → `apps/api/dist`, web → `.next`, standalone output present).

## Maintenance scripts (`apps/api/src/scripts/`)
| Script | Use |
| --- | --- |
| `check-vector-index.ts` | verify the Atlas vector index matches `ATLAS_VECTOR_INDEX_NAME` |
| `backfill-ready-at.ts` | fill `readyAt` on older books |
| `migrate-storage-to-gridfs.ts` | move stored files into GridFS |
| `reclean-chunks.ts` | re-run cleaning over existing chunks |

Re-embedding / re-chunking is versioned by `chunkingVersion`, `embeddingVersion`, `processingVersion` on the Book — bump-and-reprocess rather than mutating in place.

Related: [[Operations/Environment]] · [[Open Threads]]
