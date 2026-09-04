---
tags: [conventions]
---

# Conventions

- **Imports use explicit `.js` extensions** on relative paths (ESM + NodeNext TS). `import { X } from "../foo.js"` even though the file is `.ts`.
- **File naming:** `*.service.ts`, `*.routes.ts`, `*.model.ts`, `*.middleware.ts`, `*.test.ts`.
- **Errors:** throw `ApiError` (`utils/api-error.ts`); `error.middleware.ts` maps it. Wrap async route handlers in `asyncHandler`.
- **Comments explain *why*, not what** — the existing code does this consistently (see the `price`-missing comment in `access.service.ts`). Match that density.
- **Commits:** conventional prefixes (`feat:`, `fix(api):`). Branch is `main`.
- Secrets on models are `select: false` (`passwordHash`, `ompPasswordEnc`); encryption goes through `utils/secret-box.ts`.
- Pagination via `utils/pagination.ts`; ObjectId coercion via `utils/object-id.ts`.

Related: [[Repo Map]]
