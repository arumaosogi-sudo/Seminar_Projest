# Architecture — Digital Muscle

> Binding requirements live in `docs/plan/` (copied from the team's `palnforwork`). This file is the technical contract.
> Types for every request/response: [`shared/contract.ts`](../shared/contract.ts).

## 1. Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + Vite + TypeScript, React Router (library mode), TanStack Query, Tailwind CSS v4 |
| Backend | Cloudflare Worker + Hono (same project, `worker/`), served with the SPA via Workers Static Assets |
| Database | Cloudflare D1 (SQLite) — schema in `migrations/` |
| Auth | Sign in with Google (Google Identity Services) → Worker verifies the ID token with `jose` → session cookie |
| Dev | `npm run dev` runs Vite + the Worker (workerd) + a local D1 file — no Cloudflare account needed |
| Planned for teammates | `@dnd-kit/*` (games), `three` + `@react-three/fiber` + `@react-three/drei` (3D) |

## 2. Folders & ownership

```
shared/contract.ts        API types + zod schemas (change only by agreement — both sides depend on it)
migrations/               D1 schema (add new numbered files; never edit an applied migration)
scripts/                  seed.dev.sql, reset-local-db.mjs
worker/                   Hono API  ─ index.ts (app + routes), auth.ts, db.ts, grading.ts, routes/*
src/
  main.tsx, router.tsx    app entry + all routes (lazy-loaded pages)
  lib/                    api.ts (fetch client), auth.tsx (session hooks), format.ts
  components/ui/          shared primitives (Button, Card, Badge, Input, Logo, Spinner, EmptyState, PageHeader)
  components/student/     StudentLayout (top nav desktop/tablet, bottom nav phone), RequireStudent
  components/admin/       AdminLayout (sidebar), RequireAdmin
  pages/                  Join, Login, Onboarding, Home, Credits, Privacy
  pages/games/            🧩 teammate area — placeholders
  pages/explore/          🧩 teammate area — placeholders
  pages/tests/            🧩 teammate area — placeholders (API is ready)
  pages/admin/            Login, Classes, Tests, TestBuilder, AssignTest, Results, Students, Settings
public/images/            login-hero-{560,960}.webp
```

## 3. Auth & session rules

- **Student login**: Google ID token must have `aud = GOOGLE_CLIENT_ID`, `iss = accounts.google.com`, `email_verified = true`,
  `hd = ALLOWED_STUDENT_DOMAIN` (lamduan.mfu.ac.th) and an e-mail local part of 8–12 digits → that is the **student code**.
- **Admin login**: any verified Google account whose e-mail is in the `admins` table or in the `ADMIN_EMAILS` var (comma-separated).
- **Dev login** (`POST /api/auth/dev`): enabled only when `DEV_LOGIN=true` (set in `.dev.vars`, never in production).
  Same rules as Google but the e-mail is typed in. Used until the team has a Google OAuth Client ID.
- **Session**: HS256 JWT (`SESSION_SECRET`) in cookie `dm_session` — HttpOnly, SameSite=Lax, Secure except on localhost, 7 days.
  Payload `{ sub, role, email }`. Every `/api/admin/*` route re-checks the admin list on each request.
- **Join codes**: `/join/:code` stores the code; the login call sends it. A student is enrolled in that class unless
  (a) the class is archived, (b) the class restricts to its roster and the code isn't listed, or
  (c) the student already has an **active** enrollment in another class of the **same academic year + semester**
  (then they stay where they are and get `joinNotice`; the instructor can move them).
- A student whose enrollments are all `withdrawn` cannot log in (403 `withdrawn`).
- Anonymized students cannot log in.

## 4. Test engine rules (server-side only)

- Answers are **never** sent to students before submission. Grading happens in the Worker.
- Starting an attempt freezes the test: if no `test_versions` row exists for `(test, current_version)` it is created from the current questions.
- Editing a test whose current version already has attempts bumps `tests.current_version` (old attempts keep their snapshot).
- `deadline_at = started_at + time_limit` (NULL when no limit). Saves after `deadline + 30 s` are rejected.
  Any read/save of an expired, unsubmitted attempt **auto-submits** it with the saved answers.
- `max_attempts` (NULL = unlimited). Resuming an in-progress attempt doesn't consume another attempt.
- An assignment is open when: availability = manual → `is_open = 1`; scheduled → `opens_at <= now < closes_at`. Archived classes are never open.
- Counted score per student = highest / latest / first **submitted** attempt (score_policy).
- Grading: single = exact option id; multi = exact set match (all-or-nothing); truefalse = boolean; short = case/space-insensitive match against any accepted answer.
- `required_first = 1` on an open assignment → Home menus (Games, 3D) are locked until the student submits it.

## 5. Endpoints

### Public / auth
| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | `{ ok: true }` |
| GET | `/api/config` | `AppConfig` |
| GET | `/api/classes/by-code/:code` | `PublicClassInfo` (404 if unknown or archived) |
| POST | `/api/auth/google` | body `googleLoginBody` → `Me` + cookie |
| POST | `/api/auth/dev` | body `devLoginBody` → `Me` + cookie (404 unless DEV_LOGIN) |
| POST | `/api/auth/logout` | clears cookie |
| GET | `/api/me` | `Me` or 401 |
| PATCH | `/api/me` | student only, body `updateMeBody` |

### Student
| Method | Path | Notes |
|---|---|---|
| GET | `/api/me/status` | `StudentStatus` |
| GET | `/api/me/tests` | `StudentTestItem[]` |
| POST | `/api/attempts` | body `startAttemptBody` → `AttemptInProgress` (resumes if one is in progress) |
| GET | `/api/attempts/:id` | `AttemptInProgress` or `AttemptResult` (own attempts only) |
| PUT | `/api/attempts/:id/answers` | body `saveAnswersBody` (merge) → `{ savedAt }` |
| POST | `/api/attempts/:id/submit` | → `AttemptResult` |

### Admin (all require admin session)
| Method | Path | Notes |
|---|---|---|
| GET/POST | `/api/admin/classes` | list `AdminClass[]` (`?status=active|archived|all`) / create (`createClassBody`) — join code generated `MUS-XXXX` |
| GET/PATCH | `/api/admin/classes/:id` | detail / `updateClassBody` |
| POST | `/api/admin/classes/:id/archive` · `/unarchive` | |
| GET/POST/DELETE | `/api/admin/classes/:id/roster` | roster list / `rosterBody` / clear |
| GET | `/api/admin/students` | `?classId=&status=active|withdrawn|not_joined|all&q=` → `AdminStudentRow[]` |
| PATCH | `/api/admin/enrollments/:id` | `setEnrollmentStatusBody` (withdraw / reactivate) |
| POST | `/api/admin/enrollments/:id/move` | `moveEnrollmentBody` (attempts move with the enrollment) |
| POST | `/api/admin/students/:id/anonymize` | clears code/e-mail/name, keeps scores |
| DELETE | `/api/admin/students/:id` | deletes student + enrollments + attempts |
| GET/POST | `/api/admin/tests` | `AdminTestSummary[]` / create (`saveTestBody`) |
| GET/PUT/DELETE | `/api/admin/tests/:id` | `AdminTestDetail` / save whole test (`saveTestBody`) → `AdminTestSaveResult` / delete (409 if attempts exist) |
| GET | `/api/admin/tests/:id/assignments` | `AdminAssignment[]` (one per class that has it) |
| PUT/DELETE | `/api/admin/tests/:id/assignments/:classId` | body `assignmentSettings` / unassign (409 if attempts exist) |
| GET | `/api/admin/results` | `?classId=&testIds=1,2` → `AdminResults` (Excel export is built in the browser from `rows`) |
| GET/POST/DELETE | `/api/admin/admins` · `/api/admin/admins/:id` | `AdminUser[]` / `addAdminBody` |
| GET | `/api/admin/audit` | `?limit=50` → `AuditEntry[]` |

Every admin mutation writes an `audit_log` row.

## 6. Performance budget (from docs/plan/03_TECH_STACK.md §4)
Login/Home JS ≤ 150 KB gzip · every page lazy-loaded · `xlsx`, `qrcode` only imported inside admin pages ·
3D libraries only inside `pages/explore/*` · hero image WebP (19 KB / 39 KB).
