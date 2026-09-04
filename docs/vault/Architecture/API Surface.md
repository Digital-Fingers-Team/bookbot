---
tags: [architecture, api]
---

# API Surface

Routers mounted in `apps/api/src/app.ts`, all under `/api`:

| Mount | Router | Notes |
| --- | --- | --- |
| `/api/auth` | `auth.routes` | rate-limited (`authLimiter`) |
| `/api/upload` | `upload.routes` | rate-limited (`uploadLimiter`), multer |
| `/api/excel-import` | `excel-import.routes` | bulk book import from xlsx |
| `/api/chat` | `chat.routes` | the RAG answer endpoint |
| `/api/books` | `books.routes` | listing, reading, download |
| `/api/categories` | `categories.routes` | |
| `/api/access-requests` | `access-requests.routes` | user asks for a book |
| `/api/admin/users` | `admin-users.routes` | admin only |
| `/api/organizations` | `organizations.routes` | admin-side org CRUD |
| `/api/org-admin` | `org-admin.routes` | org_admin self-service |
| `/api/conversations` | `conversations.routes` | |
| `/api/feedback` | `feedback.routes` | |
| `/api/notifications` | `notifications.routes` | |
| `/api/stats` | `stats.routes` | analytics |
| `/api/omp` | `omp.routes` | see [[Domain/OMP Integration]] |

## Middleware
`auth.middleware` (JWT from `AUTH_JWT_SECRET`), `access.middleware` (book scope + org network policy), `rate-limit.middleware`, `validate.middleware` (schema validation), `error.middleware` (maps `ApiError` and multer errors to responses).

Related: [[Domain/Access Control]] · [[Repo Map]]
