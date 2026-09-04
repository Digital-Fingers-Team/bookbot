---
tags: [domain]
---

# Organizations (University / Org feature)

An organization is a bulk buyer (e.g. a university). It holds a **catalog** of books the org has bought, and an `org_admin` distributes access from that catalog to their own students.

- Org catalog: `allowedBookIds` + `allowedCategories` on the Organization.
- Per-book seat quota: `bookQuotas` (mixed map, book id → seat count). Granting a student a book consumes a seat.
- **Category grants to students are disabled** — an org_admin grants specific books, not whole categories.
- Downloads are separate again: `downloadableBookIds` on the org, `allowedDownloadBookIds` on the user.
- Payment happens outside the system; there is no billing code path.
- Network restriction: an org can require its users to come from `allowedIpCidrs` (campus network) — see [[Domain/Access Control]].

Surfaces: `/api/organizations` (admin), `/api/org-admin` (org_admin self-service), web routes `organizations` and `org`.

Related: [[Architecture/Data Model]]
