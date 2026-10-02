# คู่มือเพื่อนร่วมทีม (Games · 3D · Tests)

> หน้าของคุณ "ถูกจองไว้แล้ว" — route ต่อไว้ครบใน `src/router.tsx` ตอนนี้แต่ละหน้าแสดง placeholder (กรอบเส้นประ 🧩)
> พร้อม checklist ของสิ่งที่ต้องทำ ให้ **แทนที่ไฟล์ทั้งไฟล์** แต่ต้องคง `export default` ไว้

## 1. รันโปรเจกต์บนเครื่อง

```bash
npm install
cp .dev.vars.example .dev.vars     # Windows: copy .dev.vars.example .dev.vars
npm run db:reset                   # สร้าง D1 local + ใส่ข้อมูลตัวอย่าง
npm run dev                        # เปิด http://localhost:5173 (Vite + Worker + D1 ในคำสั่งเดียว)
```

- ยังไม่มี Google Client ID → ใช้ **Developer mode** ที่หน้า `/login` (เปิดเพราะ `DEV_LOGIN=true` ใน `.dev.vars`)
  - นักศึกษา: พิมพ์อีเมลรูปแบบ `6531501111@lamduan.mfu.ac.th` (ตัวเลข 8–12 หลัก = Student ID)
  - อาจารย์: `instructor@mfu.ac.th` ที่ `/admin/login` (ตรงกับ `ADMIN_EMAILS`)
- อยากเข้า Section: เปิด `/join/<JOIN-CODE>` ก่อน login (ดู join code ได้ที่ `/admin/classes`)
- เมนู Games / 3D เปิดใช้ได้เสมอ — ไม่มีการล็อกด้วย Pretest แล้ว (เอาออกเมื่อ 2 ต.ค. 2026)

## 2. หน้าไหนเป็นของใคร

| ส่วน | Route | ไฟล์ | Requirement |
|---|---|---|---|
| Games hub | `/games` | `src/pages/games/GamesHub.tsx` | GAME-1..3, 5 |
| Balloon Pop | `/games/balloon-pop` | `src/pages/games/BalloonPop.tsx` | GAME-1, 5, 6 |
| Group Sort | `/games/group-sort` | `src/pages/games/GroupSort.tsx` | GAME-2, 4, 5, 6 |
| Diameter | `/games/diameter` | `src/pages/games/Diameter.tsx` | GAME-3, 4, 5, 6 |
| Game result | `/games/result` | `src/pages/games/GameResult.tsx` | GAME-6 |
| 3D Explore | `/explore` | `src/pages/explore/Explore3D.tsx` | 3D-1..4, 7, 10, 11, 14 |
| Sarcomere | `/explore/sarcomere` | `src/pages/explore/Sarcomere.tsx` | 3D-5..9 |
| Tests list | `/tests` | `src/pages/tests/TestsList.tsx` | TEST-1, 5 |
| Take test (เต็มจอ ไม่มี nav) | `/tests/:assignmentId/take` | `src/pages/tests/TakeTest.tsx` | TEST-2..4 |
| Test result | `/tests/result/:attemptId` | `src/pages/tests/TestResult.tsx` | TEST-5 |

- หน้าที่อยู่ใต้ `/` ถูกครอบด้วย `StudentLayout` แล้ว (มี guard login, top nav, bottom tab บนมือถือ, footer) — **ไม่ต้องเช็ก login เอง**
- `TakeTest` อยู่นอก layout จึงต้องครอบตัวเองด้วย `<RequireStudent>` (มีให้แล้วใน placeholder อย่าลบ)
- ข้อมูลผู้ใช้: `useStudentMe()` จาก `@/components/student/RequireStudent` · สถานะ Home: `useStudentStatus()` / รายการข้อสอบ: `useStudentTests()` จาก `@/components/student/queries`
- UI พื้นฐาน: `Button, Card, Badge, Input, Spinner, PageLoader, EmptyState, ErrorNote, PageHeader` จาก `@/components/ui`
- สี: Games = `games` (violet) · 3D = `explore` (teal) · Tests = `tests` (blue) + `-soft` / `-ink` เช่น `bg-games-soft text-games-ink`
- ไอคอน: `@/components/student/icons` (inline SVG — ห้ามลง icon library)

## 3. Library ที่ใช้

| งาน | Library | กติกา |
|---|---|---|
| ลากวาง (Group Sort, Diameter) | `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` | ทำ engine เดียวใช้ร่วมกัน (GAME-4) เช่น `src/pages/games/dnd/` อ่านโจทย์จาก JSON · import **เฉพาะใน `src/pages/games/**`** |
| Balloon Pop | CSS animation + Pointer Events | ไม่ใช้ game engine / canvas lib |
| 3D | `three`, `@react-three/fiber`, `@react-three/drei` | import **เฉพาะใน `src/pages/explore/**`** · `frameloop="demand"` · โมเดล ≤ 3–5 MB/scene |
| ดึงข้อมูล | `@tanstack/react-query` + `api` จาก `@/lib/api` | ห้ามใช้ `fetch` ตรง ๆ |

## 4. กติกา (บังคับ)

1. **`import type` จาก `@shared/contract` เท่านั้น** — ห้าม import zod schema เข้า student page (bundle บวม)
2. ทุกหน้า lazy-load อยู่แล้ว — ห้าม import ไฟล์หน้าอื่นตรง ๆ (ใช้ `<Link>` / `navigate`)
3. Performance budget: Login/Home JS ≤ 150 KB gzip · Balloon Pop ≤ 30 KB · Group Sort/Diameter ≤ 40 KB · 3D ≤ 300 KB + โมเดล
4. **ห้ามเพิ่ม dependency ใหม่** โดยไม่ตกลงกับทีม (และบันทึกใน Change log)
5. ห้ามแก้ไฟล์ shared (`src/router.tsx`, `src/lib/**`, `src/components/ui/**`, `src/index.css`, `shared/**`, `worker/**`) — ต้องการอะไรให้แจ้งทีม
6. Responsive ตั้งแต่ 360 px · ใช้ได้ทั้งนิ้วและเมาส์ · ปุ่มเป็น `<button>` ไม่ใช่ `<div>` · มี label/alt · เคารพ `prefers-reduced-motion`
7. ทุกหน้าต้องมี loading / error / empty state และไม่มี error ใน console
8. ตรวจก่อนส่ง: `npx tsc -p tsconfig.app.json --noEmit` และ `npx vite build`

## 5. Tests API cheat-sheet (Worker พร้อมแล้ว — type อยู่ใน `shared/contract.ts`)

| Method | Path | ใช้ทำอะไร |
|---|---|---|
| GET | `/api/me/tests` | `StudentTestItem[]` — รายการข้อสอบของ Section พร้อม `status`, `attemptsUsed`, `maxAttempts`, `inProgressAttemptId`, `lastSubmittedAttemptId` |
| GET | `/api/me/status` | `StudentStatus` — คะแนน pretest/posttest |
| POST | `/api/attempts` `{ assignmentId }` | เริ่ม **หรือ resume** attempt → `AttemptInProgress` (มี `questions`, `answers`, `deadlineAt`, `serverNow`) |
| GET | `/api/attempts/:id` | `AttemptInProgress` หรือ `AttemptResult` (ถ้าหมดเวลา server จะ auto-submit ให้) |
| PUT | `/api/attempts/:id/answers` `{ answers }` | autosave แบบ merge → `{ savedAt }` · ส่งเฉพาะข้อที่เปลี่ยน debounce ~1 วินาที |
| POST | `/api/attempts/:id/submit` | ส่งข้อสอบ → `AttemptResult` (`review` เป็น `null` จนกว่าจะใช้ครบทุก attempt หรือข้อสอบปิดแล้ว และอาจารย์เปิดเฉลย — UI ต้องแสดง "Answers will be shown after your last attempt or when the test closes") |

```ts
import type { AttemptInProgress } from "@shared/contract";
import { api } from "@/lib/api";

const attempt = await api.post<AttemptInProgress>("/attempts", { assignmentId });
// นาฬิกา: ใช้เวลา server เสมอ
const offset = Date.parse(attempt.serverNow) - Date.now();
const remainingMs = attempt.deadlineAt ? Date.parse(attempt.deadlineAt) - (Date.now() + offset) : null;
```

- คำตอบ: single = option id (string) · multi = string[] · truefalse = boolean · short = string (≤ 500 ตัวอักษร)
- ส่งแล้ว (โดยเฉพาะ pretest) ให้ `queryClient.invalidateQueries({ queryKey: ["me"] })` เพื่อให้ chip ของ Tests ที่หน้า Home อัปเดต
- Error: ใช้ `ApiRequestError` (`status`, `code`) จาก `@/lib/api` แสดงข้อความที่เป็นมิตรด้วย `<ErrorNote>`
