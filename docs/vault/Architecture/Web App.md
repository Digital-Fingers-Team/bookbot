---
tags: [architecture, web]
---

# Web App

Next.js App Router in `apps/web/src/app`, components in `components/`, shared helpers in `lib/`. Talks to the API at `NEXT_PUBLIC_API_URL`.

Arabic-first: RTL by default with English support and a theme switch; user language is stored on the [[Architecture/Data Model|User]] (`language`).

| Route | Purpose |
| --- | --- |
| `login`, `register` | auth |
| `library` | catalog / discovery |
| `my-books` | granted books, progress, favorites |
| `read` | reader, evidence highlights, chat, quizzes, summary audio |
| `upload` | admin upload + Excel import |
| `users`, `organizations` | admin management |
| `org` | org_admin self-service ([[Domain/Organizations]]) |
| `requests` | access requests queue |
| `notifications`, `feedback`, `analytics`, `settings` | supporting screens |

Related: [[Architecture/API Surface]]
