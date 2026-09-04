---
tags: [domain, security]
---

# Access Control

Single source of truth: `apps/api/src/services/access/access.service.ts`. Everything else (routes, retrieval filters) consumes the resolved scope.

## resolveAccessScope(user) → AccessScope
`{ all: true }` or `{ all: false, bookIds: Set }`.

1. **admin** → `{ all: true }`.
2. **org_admin with an organizationId** → the *organization's* `allowedBookIds` plus every book in its `allowedCategories`. Note: this branch does **not** add free books.
3. **user** → their own `allowedBookIds` + books in their `allowedCategories` + **all free books** (`price <= 0` OR `price` missing, and `status: "ready"`). The `$exists:false` arm exists because legacy books predate the `price` field and `$lte` does not match a missing field.

Helpers: `canAccessBook(scope, id)`, `allowedBookIdList(scope)` (returns `null` for "all" — passed straight into the retrieval filter).

## Download access is narrower
`canDownloadBook()` defaults **closed**: admins always, everyone else needs the book in their `allowedDownloadBookIds`. Category grants and free-book status do *not* grant downloads.

## Network policy
`services/access/network-policy.service.ts` + `access.middleware.ts` enforce an organization's `allowedIpCidrs` when `networkRestrictionEnabled` is set. `target-resolution.service.ts` resolves which user/org a grant action applies to. Tests: `tests/access-scope.test.ts`, `tests/network-policy.test.ts`.

Related: [[Domain/Organizations]] · [[Architecture/RAG Pipeline]] · [[Open Threads]]
