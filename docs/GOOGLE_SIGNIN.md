# เปิดใช้ "Sign in with Google" (Google OAuth Client ID)

ระบบตรวจ Google ID token ที่ฝั่ง Worker และรับเฉพาะบัญชีที่ `hd = lamduan.mfu.ac.th` (นักศึกษา)
สิ่งที่ต้องมีมีแค่ **Client ID** (ไม่ต้องใช้ Client secret) — ทำครั้งเดียว ใช้ได้ทั้งในเครื่องและบนเว็บจริง

## 1. สร้าง Client ID (ใช้บัญชี Google ของทีม)

1. เปิด https://console.cloud.google.com/ → มุมซ้ายบน **Select a project → New project** → ตั้งชื่อ `Digital Muscle` → Create
2. เมนู **APIs & Services → OAuth consent screen** (หรือ *Google Auth Platform → Branding*)
   - User type: **External**
   - App name: `Digital Muscle` · User support e-mail: อีเมลของทีม · Developer contact: อีเมลของทีม
   - Scopes: **ไม่ต้องเพิ่ม** (ใช้แค่ `openid`, `email`, `profile` ซึ่งเป็นค่าพื้นฐาน)
   - **Publishing status → Publish app (In production)** — ถ้าค้างไว้ที่ *Testing* จะ login ได้เฉพาะอีเมลที่เพิ่มเป็น test user (สูงสุด 100 คน)
     · scope พื้นฐานแบบนี้ไม่ต้องรอ Google verify
3. เมนู **APIs & Services → Credentials → + Create credentials → OAuth client ID**
   - Application type: **Web application** · Name: `Digital Muscle web`
   - **Authorized JavaScript origins** (ใส่ทั้งสองบรรทัด):
     - `http://localhost:5173`
     - `https://digital-muscle.arumaosogi.workers.dev`
   - Authorized redirect URIs: **ไม่ต้องใส่**
   - กด Create → คัดลอก **Client ID** (หน้าตาแบบ `1234567890-xxxx.apps.googleusercontent.com`)

> Client ID ไม่ใช่ความลับ (อยู่ในหน้าเว็บอยู่แล้ว) ส่งให้คนในทีมได้ · **Client secret ไม่ต้องใช้และไม่ต้องส่งให้ใคร**

## 2. ใส่ค่าในโปรเจกต์

| ที่ไหน | ใส่อะไร |
|---|---|
| เครื่องตัวเอง | `.dev.vars` → `GOOGLE_CLIENT_ID=<Client ID>` แล้วรีสตาร์ต `npm run dev` |
| เว็บจริง | `wrangler.jsonc` → `vars.GOOGLE_CLIENT_ID` แล้ว `npm run deploy` |

## 3. ทดสอบ (สำคัญ — ทำให้เร็วที่สุด)

1. เปิด `/join/MUS-4K7P` → กด **Sign in with Google** → เลือกบัญชี **@lamduan.mfu.ac.th**
2. ผลที่เป็นไปได้:

| เห็นอะไร | แปลว่า | ทำอย่างไรต่อ |
|---|---|---|
| เข้าหน้า "Welcome! Step 2 of 2" | ✅ ใช้ได้ | จบ |
| *"Access blocked: Digital Muscle has not been approved by your organization"* หรือ *admin_policy_enforced* | มหาวิทยาลัยบล็อกแอปภายนอกสำหรับบัญชี lamduan | ขอฝ่าย IT ของ มฟล. ให้อนุญาต (trust) แอปนี้ใน Google Workspace Admin โดยแจ้ง **Client ID** ให้ — ระหว่างรอใช้บัญชีอาจารย์แบบ username/password ไปก่อน ส่วนนักศึกษายังต้องใช้ Google |
| *"Please sign in with your @lamduan.mfu.ac.th account"* | เลือกบัญชี Gmail ส่วนตัว | เลือกบัญชี lamduan ใหม่ |
| *"Google sign-in could not be verified"* | Client ID ไม่ตรงกับที่ใส่ใน `GOOGLE_CLIENT_ID` หรือ origin ไม่อยู่ในรายการ | ตรวจข้อ 1.3 และข้อ 2 |

## 4. อาจารย์ login ด้วย Google (ทีหลัง)

เมื่อได้อีเมลอาจารย์แล้ว เพิ่มที่หน้า **Admin → Settings** (หรือ `ADMIN_EMAILS` ใน `wrangler.jsonc`)
แล้วจะเลิกใช้บัญชี username/password ก็ได้ โดยลบ secret `ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH` ออก
