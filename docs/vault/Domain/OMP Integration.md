---
tags: [domain, integration]
---

# OMP Integration

Open Monograph Press is vendored under `omp/` (PHP + its own Dockerfile/compose) and used for catalog discovery, author accounts, SSO, and submission push.

## API side (`services/omp/`)
- `omp.client.ts` — HTTP client, `OMP_BASE_URL` + `OMP_CONTEXT_PATH`, auth via `OMP_API_TOKEN`.
- `omp-author.service.ts` — creates/links an OMP author account for an AradoBot user; the OMP password is stored encrypted on the User (`ompPasswordEnc`, `utils/secret-box`, key `OMP_USER_SECRET`) and `OMP_AUTHOR_GROUP_ID` picks the user group.
- `omp-push.service.ts` — pushes a ready book as an OMP submission (`OMP_PUSH_ENABLED`, `OMP_SUBMISSION_GENRE_ID`); result recorded on the Book as `ompSubmissionId` / `ompPushStatus` / `ompPushError`.
- SSO links are signed with `OMP_SSO_SECRET`.

Routes: `/api/omp`.

## Local stack
The OMP container's config is env-driven and rebuilt on every boot; press, plugin and admin state lives **only in the DB volume** — do not expect edits to files under `omp/` to persist runtime state. See [[Operations/Local Development]].

Related: [[Operations/Environment]]
