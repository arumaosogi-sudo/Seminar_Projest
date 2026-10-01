# 💪 Digital Muscle — Web Games and Virtual Muscle Model

เว็บแอปสื่อการเรียนรู้เรื่องระบบกล้ามเนื้อ (พัฒนาจาก **Key Point Book 1: The skeletal muscle** ของ ผศ.ดร.กีรกานต์ สมสวน, มฟล.)
วิชา 1305394 Seminar in Software Engineering · ทีม **MedicSync**

นักศึกษาสแกน QR ของ Section → Sign in ด้วย Google (@lamduan.mfu.ac.th) → หน้า Home 3 เมนู (**Games · 3D Explore · Tests**)
อาจารย์ใช้ **Admin dashboard** จัดการ Section/QR, สร้างข้อสอบแบบ Google Form, ดูผล Pretest/Posttest และ Export Excel

---

## 🚀 เริ่มใช้งานบนเครื่อง (ไม่ต้องมีบัญชี Cloudflare)

ต้องมี **Node.js 22+** และ Git

```bash
npm install
cp .dev.vars.example .dev.vars      # Windows PowerShell: Copy-Item .dev.vars.example .dev.vars
npm run db:reset                    # สร้างฐานข้อมูล local + ข้อมูลตัวอย่าง
npm run dev                         # เปิด http://localhost:5173
```

> ถ้า npm เตือนเรื่อง install scripts ของ `workerd` / `esbuild` ให้รัน `npm approve-scripts workerd esbuild` แล้ว `npm rebuild workerd esbuild`

**Login ตอนพัฒนา (dev mode — ใช้ได้เฉพาะในเครื่อง):**

| บทบาท | วิธี |
|---|---|
| นักศึกษา | เปิด `http://localhost:5173/join/MUS-4K7P` (Section 1) → พิมพ์อีเมลแบบ `6531501234@lamduan.mfu.ac.th` ในกล่อง *Developer mode* |
| อาจารย์ | เปิด `http://localhost:5173/admin/login` → พิมพ์ `instructor@mfu.ac.th` |

เมื่อได้ **Google OAuth Client ID** แล้ว ใส่ใน `GOOGLE_CLIENT_ID` (`.dev.vars` ตอน dev / `wrangler.jsonc` ตอน deploy) ปุ่ม *Sign in with Google* จะใช้ได้ทันที

## 🧰 คำสั่ง

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | Vite + Worker API + D1 local ในคำสั่งเดียว |
| `npm run build` | type-check + build production |
| `npm test` | unit tests (Vitest) |
| `npm run db:reset` | ลบฐานข้อมูล local แล้วสร้างใหม่ + seed |
| `npm run db:migrate` | apply migration ใหม่กับฐานข้อมูล local |
| `npm run cf-typegen` | สร้าง type ของ Env ใหม่หลังแก้ `wrangler.jsonc` |
| `npm run deploy` | build + deploy ขึ้น Cloudflare (ต้อง `wrangler login` และสร้าง D1 ก่อน — ดูด้านล่าง) |

## 📁 โครงสร้าง

```
docs/plan/            ⚖️ ข้อบังคับ + requirement + stack + แผนงาน (อ่านก่อนเริ่มงาน)
docs/ARCHITECTURE.md  สัญญา API, กติกา auth/ข้อสอบ, endpoint ทั้งหมด
docs/DESIGN_NOTES.md  ค่าจาก Figma (สี ขนาด ฟอนต์ layout) + ข้อแตกต่างที่ตั้งใจ — อ่านก่อนทำหน้าใหม่
docs/TEAMMATE_GUIDE.md คู่มือสำหรับเพื่อนในทีมที่รับทำหน้า Games / 3D / Tests
shared/contract.ts    type + zod schema ที่ frontend และ API ใช้ร่วมกัน
migrations/           schema ของ D1
worker/               API (Cloudflare Worker + Hono)
src/                  React app
  pages/              Login, Join, Onboarding, Home, Credits, Privacy
  pages/admin/        หน้าอาจารย์ทั้งหมด
  pages/games/        🧩 เพื่อนในทีม (placeholder)
  pages/explore/      🧩 เพื่อนในทีม (placeholder)
  pages/tests/        🧩 เพื่อนในทีม (placeholder — API พร้อมแล้ว)
```

## 👥 แบ่งงาน

| ส่วน | ผู้รับผิดชอบ | สถานะ |
|---|---|---|
| Login / Join QR / Onboarding, ฐานข้อมูล, API ทั้งหมด (รวม API ทำข้อสอบ + ตรวจคะแนน), Home, Admin ทุกหน้า | nitiphum01 | ✅ รอบแรกเสร็จ |
| Games (Balloon Pop, Group Sort, Diameter, Result) | เพื่อนในทีม | 🧩 placeholder |
| 3D Explore + Sarcomere | เพื่อนในทีม | 🧩 placeholder |
| หน้าทำข้อสอบ / ผลสอบ (UI) | เพื่อนในทีม | 🧩 placeholder |

## ☁️ Deploy ขึ้น Cloudflare (เมื่อพร้อม)

```bash
npx wrangler login
npx wrangler d1 create digital-muscle-db      # นำ database_id ที่ได้ไปใส่ใน wrangler.jsonc
npm run db:migrate:remote
npx wrangler secret put SESSION_SECRET        # สุ่มข้อความยาว ≥ 32 ตัวอักษร
npm run deploy
```

ตั้งค่า `GOOGLE_CLIENT_ID` และ `ADMIN_EMAILS` ใน `wrangler.jsonc` → `vars` · **ห้ามตั้ง `DEV_LOGIN` บน production**

## 🔒 ข้อมูลส่วนบุคคล (PDPA)
เก็บเฉพาะ Student ID, ชื่อต้น, อีเมลมหาวิทยาลัย และคำตอบ/คะแนน · อาจารย์ Withdraw / Archive / Anonymize / Delete ได้จากหน้า Students
