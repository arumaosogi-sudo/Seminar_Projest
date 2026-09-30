# 03 — Tech Stack (Stack ที่ต้องใช้)

> หลักการเลือก: **เบา · โหลดเร็ว · ลื่นบนมือถือ · ไม่ต้องติดตั้ง · ไม่หลับเมื่อไม่มีคนใช้ · ฟรี**
> ห้ามเปลี่ยน/เพิ่ม library หลักโดยไม่บันทึกใน Change log (README)

## 1. Stack ร่วม (ใช้ทุกหน้า)

| ชั้น | เทคโนโลยี | หน้าที่ |
|---|---|---|
| ภาษา | **TypeScript** | ใช้ทั้ง frontend และ backend ใช้ type ร่วมกันได้ |
| Build | **Vite** | build เร็ว แยก chunk ตาม route อัตโนมัติ |
| UI | **React 18** + **React Router** | SPA + lazy load ทีละหน้า |
| CSS | **Tailwind CSS** | ไม่มี runtime ไฟล์ CSS เล็ก |
| ดึงข้อมูล | **TanStack Query** | cache + retry เมื่อเน็ตหลุด |
| ตรวจข้อมูล | **Zod** | schema เดียวกันทั้ง frontend และ Worker |
| Hosting | **Cloudflare Pages** | CDN ใกล้ไทย ฟรี bandwidth ไม่จำกัด |
| API | **Cloudflare Workers + Hono** | ไม่หลับ ตอบระดับ ms ฟรี 100,000 req/วัน |
| Database | **Cloudflare D1** (SQL/SQLite) | ไม่ pause ฟรี 5 GB |
| ไฟล์ | **Cloudflare R2** | โมเดล 3D, รูปประกอบข้อสอบ (ฟรี 10 GB ไม่คิดค่าดาวน์โหลด) |
| Auth | **Google Identity Services** + **jose** | ตรวจ Google ID token ใน Worker + ตรวจ `hd` |
| Deploy / CI | **GitHub + GitHub Actions + Wrangler** | push แล้ว deploy อัตโนมัติ |
| ทดสอบ | **Vitest** (unit) · **Playwright** (E2E) · **Lighthouse CI** (performance) | ใช้เป็นตัวชี้วัดใน paper ด้วย |
| Lint / Format | **ESLint + Prettier** | โค้ดรูปแบบเดียวกันทั้งทีม |

**ข้อจำกัดที่ต้องจำ:** Worker ฟรีใช้ CPU ได้ 10 ms ต่อ request → งานหนัก (สร้าง Excel, สร้าง QR) **ทำที่ browser ของ admin**

---

## 2. Stack รายหน้า

### 2.1 ฝั่งนักศึกษา

| # | หน้า (Route) | Frontend | API (Worker) | ตาราง DB | ขนาด JS (gzip) | หมายเหตุ |
|---|---|---|---|---|---|---|
| 1 | **QR Join** `/join/:code` | React Router | `GET /api/classes/by-code/:code` | `classes` | ≤ 150 KB (รวม core) | 1 QR = 1 Section |
| 2 | **Login** `/login` | Google Identity Services (โหลดเฉพาะหน้านี้) | `POST /api/auth/google` | `students`, `enrollments` | + GIS script | ตรวจ `hd` ที่ server |
| 3 | **Onboarding** `/onboarding` | React + Zod | `PATCH /api/me` | `students` | – | กรอกชื่อต้นครั้งเดียว |
| 4 | **Home** `/` | React + Tailwind | `GET /api/me/status` | `attempts` | – | 3 เมนู |
| 5 | **Game Hub** `/games` | React | – | – | ~5 KB | การ์ด 3 เกม |
| 6 | **Balloon Pop** `/games/balloon` | CSS animation + Pointer Events | – (โจทย์เป็น JSON static) | – | ≤ 30 KB | |
| 7 | **Group Sort** `/games/sort` | **dnd-kit** + engine ลากวาง | – | – | ≤ 40 KB | engine ร่วมกับหน้า 8 |
| 8 | **Diameter** `/games/diameter` | **dnd-kit** + engine ลากวาง | – | – | (chunk ร่วม) | |
| 9 | **3D Explore** `/3d` | **React Three Fiber + drei** (`CameraControls`, `Html`, `useGLTF`) | – (โมเดลจาก R2) | – | ≤ 300 KB + โมเดล ≤ 3–5 MB/scene | บินกล้อง + fade |
| 10 | **Sarcomere** `/3d/sarcomere` | R3F + instancing + range slider + YouTube embed | – | – | (chunk ร่วม) | `frameloop="demand"` |
| 11 | **Test List** `/tests` | React + TanStack Query | `GET /api/me/tests` | `test_assignments`, `attempts` | – | |
| 12 | **ทำข้อสอบ** `/tests/:id` | React + countdown (sync เวลา server) | `POST /api/attempts` · `PUT /api/attempts/:id` · `POST /api/attempts/:id/submit` | `attempts`, `test_versions` | ≤ 30 KB | ไม่ส่งเฉลยมาที่ client |
| 13 | **ผลสอบ** `/tests/:id/result` | React | `GET /api/attempts/:id` | `attempts` | – | |
| 14 | **Credits / Privacy** `/credits` | React | – | – | ~3 KB | license โมเดล + privacy notice |

### 2.2 ฝั่ง Admin (แยก chunk ทั้งหมด — นักศึกษาไม่ต้องโหลด)

| # | หน้า (Route) | Frontend | API (Worker) | ตาราง DB | หมายเหตุ |
|---|---|---|---|---|---|
| 15 | **Admin Login** `/admin/login` | Google Identity Services | `POST /api/auth/google` + ตรวจสิทธิ์ | `admins` | |
| 16 | **Classes** `/admin/classes` | React + **qrcode** (lazy) | `CRUD /api/admin/classes` · `POST /api/admin/classes/:id/roster` | `classes`, `enrollments` | สร้าง QR, roster (Should) |
| 17 | **Test Builder** `/admin/tests/:id/edit` | React + **dnd-kit** + Zod | `CRUD /api/admin/tests` · `/api/admin/questions` · `POST /api/admin/uploads` | `tests`, `questions`, `test_versions` | แบบ Google Form + ล็อกเวอร์ชัน |
| 18 | **ตั้งค่าการสอบ** `/admin/tests/:id/assign` | React | `CRUD /api/admin/assignments` | `test_assignments` | เวลา, จำนวนครั้ง, วันเปิด-ปิด |
| 19 | **Dashboard** `/admin/results` | React + **Chart.js** (lazy) + **TanStack Table** | `GET /api/admin/results?class=&test=` | `attempts`, `enrollments` | รวมคะแนนด้วย SQL |
| 20 | **Export Excel** (ปุ่มในหน้า 19) | **SheetJS** (lazy, สร้างที่ browser) | ใช้ข้อมูลเดียวกับหน้า 19 | – | |
| 21 | **Students** `/admin/students` | React | `PATCH /api/admin/enrollments/:id` · `POST /api/admin/classes/:id/archive` · `POST /api/admin/students/:id/anonymize` · `DELETE` | `students`, `enrollments`, `audit_log` | ยืนยัน 2 ชั้น |

---

## 3. Data model (D1)

| ตาราง | คอลัมน์หลัก | หมายเหตุ |
|---|---|---|
| `students` | id, student_id (unique), first_name, email, status (`active`/`withdrawn`/`anonymized`), created_at | |
| `admins` | id, email (unique), name, role | |
| `classes` | id, academic_year, semester, section, name, join_code (unique), status (`active`/`archived`), archived_at | 1 แถว = 1 Section |
| `enrollments` | id, student_id → students, class_id → classes, status, joined_at | unique (student, class) |
| `tests` | id, title, description, kind (`pretest`/`posttest`/`other`), current_version_id, created_by | |
| `questions` | id, test_id, order, type (`single`/`multi`/`truefalse`/`short`/`matching`), prompt, image_key, options (JSON), answer (JSON), points, required | answer **ห้ามส่งให้ client** |
| `test_versions` | id, test_id, version_no, snapshot (JSON ของข้อสอบทั้งชุด), created_at | สร้างเมื่อมีคนเริ่มทำหลังแก้ไข |
| `test_assignments` | id, test_id, class_id, time_limit_min (null = ไม่จำกัด), max_attempts (null = ไม่จำกัด), score_policy (`highest`/`latest`/`first`), opens_at, closes_at, show_answers | |
| `attempts` | id, enrollment_id, assignment_id, test_version_id, started_at, deadline_at, submitted_at, answers (JSON), score, max_score | deadline คำนวณที่ server |
| `audit_log` | id, admin_id, action, target_type, target_id, detail (JSON), created_at | |

---

## 4. Performance budget (บังคับ)

| สิ่งที่วัด | เกณฑ์ | วัดด้วย |
|---|---|---|
| JS ที่โหลดตอนเปิด Login / Home | ≤ 150 KB gzip | `vite build` + rollup-plugin-visualizer |
| เกมแต่ละเกม | ≤ 50 KB gzip | ” |
| หน้า 3D | ≤ 300 KB gzip + โมเดล ≤ 3–5 MB ต่อ scene | ” + gltf.report |
| LCP บนมือถือ 4G | < 2.5 วินาที | Lighthouse |
| Lighthouse Performance | ≥ 90 (หน้า non-3D) | Lighthouse CI |
| 3D frame rate | ~60 fps มือถือระดับกลาง (ขั้นต่ำ 30 fps) | drei `PerformanceMonitor` / r3f-perf |
| API response (p95) | < 300 ms | Worker logs |

**เทคนิคที่ต้องใช้:**
- lazy load ทุก route
- 3D: จำกัด DPR ไว้ที่ 1.5, `frameloop="demand"`, instancing สำหรับ filament
- โมเดลบีบอัด Draco/Meshopt, texture เป็น KTX2
- library หนัก (SheetJS, Chart.js, qrcode) โหลดเฉพาะในหน้า admin

---

## 5. โมเดล 3D — แหล่งที่มาและขั้นตอน

### 5.1 แหล่งดาวน์โหลด

| แหล่ง | มีอะไร | License | ใช้กับ |
|---|---|---|---|
| **Z-Anatomy** (z-anatomy.com / GitHub) | Atlas กายวิภาคทั้งร่าง รวมกล้ามเนื้อ หัวใจ อวัยวะ | CC BY-SA 4.0 | ⭐ แขน/biceps, หัวใจ, กระเพาะ **(แหล่งหลัก)** |
| **BodyParts3D** (DBCLS, lifesciencedb.jp) | อวัยวะแยกชิ้น | CC BY-SA 2.1 JP | ระดับอวัยวะ |
| **Sketchfab** (กรอง *Downloadable*) | ทุกระดับ รวมโมเดลเซลล์ | แตกต่างกันทีละโมเดล | fascicle, muscle fiber, หัวใจ |
| **NIH 3D** (3d.nih.gov) | กายวิภาคและโมเลกุล | ส่วนใหญ่ public domain / CC | อวัยวะ / โมเลกุล |
| **RCSB PDB** (rcsb.org) | โครงสร้างโปรตีนจริง (actin, myosin) | CC0 | โมเลกุล (Future) |
| **AnatomyTOOL** (anatomytool.org) | สื่อกายวิภาคแบบ open | CC หลายแบบ | เสริม |

### 5.2 ส่วนที่สร้างเอง

| ระดับ | วิธี |
|---|---|
| Fascicle → Muscle fiber → Myofibril | **Blender** — ทรงกระบอกซ้อน + texture ลาย striation |
| **Sarcomere** | **สร้างด้วยโค้ดใน R3F** เพื่อให้ slider ควบคุมได้ตรงตาม sliding filament theory |

> ห้ามใช้โมเดลจาก AI text-to-3D (Meshy, Tripo ฯลฯ) กับโครงสร้างกายวิภาค เพราะความถูกต้องทางวิชาการต่ำ

### 5.3 ขั้นตอนเตรียมโมเดล (บังคับทุกโมเดล)
```
ดาวน์โหลด → ลงตารางเครดิต (credits.json) ทันที
  → Blender: ตัดส่วนที่ไม่ใช้ + ลด polygon (~50–100k triangles/scene)
  → export .glb → gltf-transform (Draco/Meshopt + KTX2)
  → ตรวจขนาดที่ gltf.report → gltfjsx สร้าง component → อัปโหลด R2
```

### 5.4 License
- **BY** = ต้องให้เครดิต
- **SA** = โมเดลที่ดัดแปลงต้องเผยแพร่ด้วย license เดียวกัน
- **NC** = ห้ามใช้เชิงพาณิชย์ (ใช้ในงานมหาวิทยาลัยได้)
- ทุกโมเดลต้องแสดงในหน้า `/credits`

### 5.5 แหล่งดูเป็นตัวอย่าง UX
BioDigital Human (human.biodigital.com) · Zygote Body (zygotebody.com) · Visible Body / Complete Anatomy (ดูจากวิดีโอตัวอย่าง) · ตัวอย่างโค้ด drei (drei.docs.pmnd.rs)
