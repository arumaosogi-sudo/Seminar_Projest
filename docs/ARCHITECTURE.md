# Architecture — Digital Muscle

> Binding requirements live in `docs/plan/` (copied from the team's `palnforwork`). This file is the technical contract.
> Types for every request/response: [`shared/contract.ts`](../shared/contract.ts).

## 1. Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + Vite + TypeScript, React Router (library mode), TanStack Query, Tailwind CSS v4 |
| Backend | Cloudflare Worker + Hono (same project, `worker/`), served with the SPA via Workers Static Assets |
| Database | Cloudflare D1 (SQLite) — schema in `migrations/` |
| Files | Cloudflare R2 bucket `digital-muscle-images` (binding `IMAGES`) — question images, key `images/<id>` (migration 0008) |
| Auth | Sign in with Google (Google Identity Services) → Worker verifies the ID token with `jose` → session cookie |
| Dev | `npm run dev` runs Vite + the Worker (workerd) + a local D1 file — no Cloudflare account needed |
| Games | `src/muscle-games/` — the Muscle Games module (plain React + CSS, shared with the team's standalone repo), mounted at `/games/*` |
| 3D | `three` + `@react-three/fiber` + `@react-three/drei`, only inside `src/pages/explore/**` |

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
  pages/games/            MuscleGamesPage.tsx — mounts src/muscle-games/ (hub, Balloon Pop, Group Sort, Diameter) and saves scores
  muscle-games/           games module (PatiphatDam, PR #1): games/, components/, scores.jsx, outbox.js, styles.css
  pages/explore/          3D Explore + Sarcomere
  pages/tests/            Tests list / take test / result
  pages/admin/            Login, Classes, Tests, TestBuilder, AssignTest, Results, GameScores, Students, Settings
public/images/            logo.png, login-hero-{desktop,tablet,phone}-*.webp, menu-*.png (see docs/DESIGN_NOTES.md)
```

## 3. Auth & session rules

- **Student login**: Google ID token must have `aud = GOOGLE_CLIENT_ID`, `iss = accounts.google.com`, `email_verified = true`,
  `hd` ∈ `ALLOWED_STUDENT_DOMAIN` (comma-separated, now `lamduan.mfu.ac.th,mfu.ac.th`) and `hd` = the e-mail's domain
  (personal Gmail has no `hd` → rejected). On lamduan the local part must be the 8–12 digit **student code**; on other
  allowed domains (mfu.ac.th staff/TA) the local part itself is stored as the student code.
- **Admin login**: any verified Google account whose e-mail is in the `admins` table or in the `ADMIN_EMAILS` var (comma-separated).
- **Password admin** (`POST /api/auth/admin-password`): optional local instructor account from `ADMIN_USERNAME` +
  `ADMIN_PASSWORD_HASH` (PBKDF2-SHA256, `npm run admin:hash`; only the hash is stored). Session e-mail is
  `local:<username>`; it stops working as soon as either var is removed. Max 5 failures per IP per 15 min
  (`admin_login_attempts`, migration 0004); successful logins are audit-logged.
- **Dev login** (`POST /api/auth/dev`): enabled only when `DEV_LOGIN=true` (set in `.dev.vars`, never in production).
  Same rules as Google but the e-mail is typed in. Used until the team has a Google OAuth Client ID.
- **Session**: HS256 JWT (`SESSION_SECRET`) in cookie `dm_session` — HttpOnly, SameSite=Lax, Secure except on localhost, 7 days.
  Payload `{ sub, role, email }`. Every `/api/admin/*` route re-checks the admin list on each request.
- **Join codes**: `/join/:code` stores the code; the login call sends it. A student is enrolled in that class unless
  (a) the class is archived, (b) the class restricts to its roster and the code isn't listed, or
  (c) the student already has an **active** enrollment in another class of the **same academic year + semester**
  (then they stay where they are and get `joinNotice`; the instructor can move them).
- A student whose enrollments are all `withdrawn` cannot log in (403 `withdrawn`).
- Anonymized students cannot log in: anonymizing stores HMAC-SHA256(e-mail / student code, `SESSION_SECRET`) in
  `anonymized_identities` and login checks it (rotating `SESSION_SECRET` invalidates these hashes).
- Dev login also requires the request host to be localhost / 127.0.0.1 / [::1].
- Security headers for the SPA: `public/_headers` (CSP, frame-ancestors none, …). Body limit 64 KB (1 MB for tests/roster).

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
- Answer review (`show_answers = 1`) is returned only after the student's **last allowed attempt** or once the test is
  **closed** — otherwise students could read the answers and retake for a higher score.
- Submit is two-step (claim `submitted_at`, then re-read answers and grade) so a late autosave can't change the graded answers.
- `required_first` is still stored and `menusLocked` is still returned by `/api/me/status`, but the UI no longer locks Games / 3D (removed 2026-10-02 by request) — both menus are always open.

## 4.1 Game score rules (GAME-7, migration 0009)

- Every run of a game is scored **out of 10** (one decimal) from the share of right answers. Group Sort has two modes
  (score keys `group-sort:memory`, `group-sort:conveyor`); the other games have one key each.
- The games module calls the host's `onGameFinish(run)`; `MuscleGamesPage.tsx` posts it to `POST /api/me/game-runs`.
  The server takes student, enrollment and section from the **session**, never from the body. `run_id` is made by the
  game, `UNIQUE(student_id, run_id)` makes a re-sent run (Diameter resumed, offline retry) update its row, not add one.
- A run whose save fails (Wi-Fi drop) waits in the browser (`src/muscle-games/outbox.js`, tagged with the student id)
  and is re-sent on load, when the device is back online and every 20 s — only while the same student is signed in.
- **A student's collected score for a game = their best run in any mode.** The instructor sees it on Admin → Game scores
  (`GET /api/admin/game-results`, total out of 30); the student sees the same number as "Your best" on `/games`
  (`GET /api/me/game-runs` merged with this tab's best, the higher wins). Game scores are separate from Pretest/Posttest.
- Scores are reported by the browser (practice games, not exams) — the server only checks range 0–10 and the score key.
- `game_runs.class_id` is a copy of the section when the run was played; moving an enrollment updates it, and deleting a
  section removes runs **by enrollment** (so a student moved out keeps their scores). Deleting a student removes their runs.
- Runs played while the student is in no section have no enrollment and are not shown to any instructor.

## 5. Endpoints

### Public / auth
| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | `{ ok: true }` |
| GET | `/api/config` | `AppConfig` |
| GET | `/api/classes/by-code/:code` | `PublicClassInfo` (404 if unknown or archived) |
| POST | `/api/auth/google` | body `googleLoginBody` → `Me` + cookie |
| POST | `/api/auth/admin-password` | body `adminPasswordLoginBody` → `Me` + cookie (404 unless configured, 401 wrong, 429 throttled) |
| POST | `/api/auth/dev` | body `devLoginBody` → `Me` + cookie (404 unless DEV_LOGIN) |
| POST | `/api/auth/logout` | clears cookie |
| GET | `/api/me` | `Me` or 401 |
| PATCH | `/api/me` | student only, body `updateMeBody` |
| POST | `/api/me/join` · `/api/me/leave` | student joins a section by join code / leaves the current one (joined by mistake; refused with 409 `has_attempts` once a test was started there) → `Me` |

### Student
| Method | Path | Notes |
|---|---|---|
| GET | `/api/me/status` | `StudentStatus` |
| GET | `/api/me/tests` | `StudentTestItem[]` |
| POST | `/api/attempts` | body `startAttemptBody` → `AttemptInProgress` (resumes if one is in progress) |
| GET | `/api/attempts/:id` | `AttemptInProgress` or `AttemptResult` (own attempts only) |
| PUT | `/api/attempts/:id/answers` | body `saveAnswersBody` (merge) → `{ savedAt }` |
| POST | `/api/attempts/:id/submit` | → `AttemptResult` |
| POST | `/api/me/game-runs` | body `gameRunBody` (one run, score 0–10) → 201 `{ ok }`; same `runId` again updates the run |
| GET | `/api/me/game-runs` | `GameBest[]` — the student's saved best per score key (shown as "Your best" on `/games`) |

### Admin (all require admin session)
| Method | Path | Notes |
|---|---|---|
| GET/POST | `/api/admin/classes` | list your own `AdminClass[]` (username account: all) (`?status=active|archived|all`) / create (`createClassBody`) — join code generated `MUS-XXXX` |
| PATCH/DELETE | `/api/admin/classes/:id` | `updateClassBody` (new join code, turn roster-only off) / delete the section (owner only) |
| POST | `/api/admin/classes/:id/owner` | username account only: hand a section to an instructor (`setOwnerBody`) — renamed with their short name |
| GET | `/api/admin/students` | `?classId=&status=active|withdrawn|all&q=` → `AdminStudentRow[]` (no classId = all your active sections; someone else's section → 404) |
| GET | `/api/admin/students/unassigned` | username account only: signed-in students in no section |
| PATCH | `/api/admin/enrollments/:id` | `setEnrollmentStatusBody` (withdraw / reactivate) |
| POST | `/api/admin/enrollments/:id/move` | `moveEnrollmentBody` (attempts and game runs move with the enrollment) |
| POST | `/api/admin/students/:id/anonymize` | clears code/e-mail/name, keeps scores |
| DELETE | `/api/admin/students/:id` | deletes student + enrollments + attempts + game runs |
| GET/POST | `/api/admin/tests` | your own `AdminTestSummary[]` (username account: all; `?classId=` one of your sections = every test assigned to it) / create (`saveTestBody`) |
| POST | `/api/admin/tests/:id/owner` | username account only: hand a test to an instructor (`setOwnerBody`) |
| GET/PUT/DELETE | `/api/admin/tests/:id` | (someone else's test → 404) `AdminTestDetail` / save whole test (`saveTestBody`) → `AdminTestSaveResult` / delete (409 if attempts exist) |
| GET | `/api/admin/tests/:id/assignments` | `AdminAssignment[]` (one per class that has it) |
| PUT/DELETE | `/api/admin/tests/:id/assignments/:classId` | body `assignmentSettings` / unassign (409 if attempts exist) |
| GET | `/api/admin/results` | `?classId=&testIds=1,2` → `AdminResults` (Excel export is built in the browser from `rows`) |
| GET | `/api/admin/game-results` | `?classId=&status=all` → `AdminGameResults` (best per game per student, total /30; your own sections only; Excel export in the browser) |
| GET/POST/DELETE | `/api/admin/admins` · `/api/admin/admins/:id` | `AdminUser[]` / `addAdminBody` — username (emergency) account only |
| GET | `/api/admin/usage` | username account only: database size (Settings → Storage) |
| GET | `/api/admin/audit` | `?limit=50` → the signed-in admin's own `AuditEntry[]`, with names looked up (`names`) |

Every admin mutation writes an `audit_log` row.

## 6. Performance budget (from docs/plan/03_TECH_STACK.md §4)
Login/Home JS ≤ 150 KB gzip · every page lazy-loaded · `xlsx`, `qrcode` only imported inside admin pages ·
3D libraries only inside `pages/explore/*` · hero image WebP (19 KB / 39 KB).

## 7. Capacity (Workers Free plan)

Free-plan quotas (Cloudflare docs, Oct 2026): 100,000 Worker requests/day · D1 5 M rows read and 100,000 rows written/day ·
5 GB D1 storage per account · 10 ms CPU per request. Static assets (the SPA, images in `public/`) are free and unlimited.
Daily quotas reset at 00:00 UTC (07:00 in Thailand); D1 enforces them since 1 Sep 2026.

Design rules that keep ~4,000 students / 100 instructors / a pre+post test every day inside those quotas:

| Area | Rule | Where |
|---|---|---|
| Taking a test | Answers live in the browser (localStorage) and survive a reload; the server gets a checkpoint every 2 min, when the tab is hidden, every 15 s in the last 90 s of a timed test, and the rest **with the submit** (`POST /attempts/:id/submit { answers }`) | `TakeTest.tsx`, `routes/attempts.ts` |
| Admin lists | No automatic polling unless the instructor turns **Live** on (15 s, switches itself off after 2 h); otherwise a Refresh button | `components/admin/live.tsx` |
| Classes page counts | Read from `enrollment_progress` (one row per enrollment × test kind, written when an attempt is finalised) instead of scanning attempts | migration 0006, `engine.finalizeAttempt`, `admin/common.ts` |
| Many instructors | Class lists default to **my classes** (`classes.owner_email`, legacy NULL = everyone); "All classes" on demand | `admin/common.ts scopeWhere` |
| Student pages | `/me` cached 5 min, status 2 min, test list 1 min; a submit refreshes status + tests only | `lib/auth.tsx`, `student/queries.ts` |
| Storage | Question images live in R2 (D1 keeps only metadata). Game runs are kept until the student or section is deleted. Daily Cron (20:00 UTC) prunes audit log > 1 year, login-throttle rows, unused images > 1 day, unowned tests that are empty and unedited for 7 days; Settings → Storage shows size vs 500 MB and warns at 80 %; end of semester: export, then Delete class | `worker/maintenance.ts`, `wrangler.jsonc` |

Rough budget for the scenario above: ~70,000 requests, ~50,000 rows written and ~1 M rows read per day; ~400 MB of data per
semester before clean-up. If usage grows past that, move to Workers Paid or an MFU-hosted server.

### 7.1 Decisions for ~1,000 students / ~30 instructors (16 Oct 2026, implemented in migration 0007)

Analysis: fits the Workers Free plan (~45–60 % of daily requests, ~30 % of writes, ~160 MB per semester).
Instructor "Live" polling is the largest consumer; Results-in-Live is the only read-quota risk.

| # | Decision | Implementation notes |
|---|---|---|
| A | **Private by owner (changed 11 Nov 2026): instructors see and change only their own classes, students and tests; no head/super admin.** Someone else's class or test answers 404. | `tests.owner_email` (like `classes.owner_email`); server checks in `worker/routes/admin/common.ts` (`assertOwner`, 403 `not_owner`) on class PATCH/archive/DELETE/roster, enrollment actions, student anonymize/delete (must own all their sections), test PUT/DELETE, assignment PUT/DELETE (any test may be used, only in your own classes). Lists are filtered with `ownedClasses` / `visibleTests`. **The emergency password account sees and changes everything** and hands items to an instructor (`POST …/owner`, Settings → Instructors list the candidates). Rows with no owner (made before 0007) are visible only to the emergency account until it hands them over; unowned tests that are empty and unedited for 7 days are deleted by the daily cron. |
| B | **Section numbers may repeat across instructors.** Name shows the instructor: "2569/1 · Section 1 · Keerakarn". | Rebuilt `classes` with `UNIQUE(owner_email, academic_year, semester, section)` (dependent rows copied aside and restored — dropping a table runs its cascades); student pages already parse "year/sem · rest". |
| C | **Keep the username/password account for emergencies; throttle per IP + username** (campus NAT shares one IP). | `admin_login_attempts.username`; max 5 failures per (ip, username) in 15 min. |
| D | **Keep Live as is** (15 s; Results 30 s; auto-off after 2 h). | Revisit if daily reads approach 5 M. |
