---
tags: [ops]
---

# Local Development

```bash
pnpm install
cp .env.example .env          # PowerShell: Copy-Item .env.example .env
docker compose up -d          # MongoDB Atlas Local (Search + Vector Search)
pnpm dev                      # scripts/dev.mjs runs api + web together
```

- `pnpm start` (`scripts/start.mjs`) is the production-style runner.
- Node ≥ 20.20.0, pnpm 10.34.3 (pinned via `packageManager`).
- Compose volumes: `aradobotd-mongo-data`, `-config`, `-mongot`. Vector search needs the mongot volume to be healthy; `apps/api/src/scripts/check-vector-index.ts` verifies the index exists.
- OMP runs from its own `omp/docker-compose.yml` — its config is regenerated from env at every boot, so press/plugin/admin state lives only in the DB volume ([[Domain/OMP Integration]]).
- `scripts/create-test-workbook.mjs` builds a books xlsx for the Excel import path (`books-test-10.xlsx` at the root is a sample).

Related: [[Operations/Environment]] · [[Operations/Testing]]
