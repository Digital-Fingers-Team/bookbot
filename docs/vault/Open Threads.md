---
tags: [status]
updated: 2026-09-05
---

# Open Threads

Live issues to check before assuming they're done. Update this note when one closes.

- [ ] **Placeholder secrets in the live `.env`** — `AUTH_JWT_SECRET`, `ADMIN_API_KEY`, `DEFAULT_ADMIN_PASSWORD` were still the example values. Treat the deployment as open until rotation is confirmed. → [[Operations/Environment]]
- [ ] **Legacy books missing `price`** — 2 production books have no `price` field. The code handles it (`$exists:false` arm in `resolveAccessScope`), but the DB backfill has not been applied. → [[Domain/Access Control]]
- [ ] `deploy-patches/0001-topublicuser-promise.patch` is untracked in git — decide whether it belongs in the repo or is already folded into `1f41ea1`.
- [ ] `category` (string) vs `categories` (array) on Book — both are still queried with `$or`. Consolidating would simplify access resolution.
- [ ] `org_admin` scope does not include free books, unlike a plain `user`. Confirm that's intended.

Related: [[Home]] · [[Decisions]]
