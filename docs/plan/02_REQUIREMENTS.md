# 02 — Requirements (สิ่งที่ต้องทำในโปรเจกต์)

> ระดับความสำคัญ: **Must** = ต้องเสร็จก่อน Prototype (29 ต.ค.) · **Should** = ทำถ้ามีเวลาใน W12 · **Future** = เขียนเป็น Future Work ใน paper

## 1. User flow

```
[สแกน QR ของ Section]
      ↓
[Login ด้วย Google — เฉพาะ @lamduan.mfu.ac.th]
      ↓ (ครั้งแรกเท่านั้น)
[กรอกชื่อต้น]
      ↓
[Pretest] ← ถ้า Admin เปิดไว้และยังไม่ได้ทำ ต้องทำก่อนจึงจะเข้าเมนูอื่นได้
      ↓
[HOME]
 ├─ 🎮 GAME  → Balloon Pop · Group Sort · Diameter
 ├─ 🧬 3D    → Topic → Sub-topic → … → Sarcomere
 └─ 📝 TEST  → Pretest / Posttest (ตามที่ Admin เปิด)
```

- Home มี **3 เมนู** (ถ้าหน้า 3D แน่นเกินไป ให้แยกเมนู LEARN เป็นเมนูที่ 4 — ต้องบันทึกใน Change log)
- เนื้อหา Key Point Book ใส่เป็น **info panel** ในหน้า 3D และหน้าเกม

---

## 2. Login & ตัวตนนักศึกษา

| ID | Requirement | ระดับ |
|---|---|---|
| AUTH-1 | Login ด้วย **Sign in with Google** เท่านั้น | Must |
| AUTH-2 | Server ตรวจ `hd` claim = `lamduan.mfu.ac.th` — ถ้าไม่ใช่ ปฏิเสธ | Must |
| AUTH-3 | ดึง **Student ID** จากอีเมล (`รหัส@lamduan.mfu.ac.th`) อัตโนมัติ | Must |
| AUTH-4 | กรอก **ชื่อต้น** ครั้งแรกครั้งเดียว | Must |
| AUTH-5 | สแกน QR ของ Section → ผูกนักศึกษาเข้า Section นั้นอัตโนมัติ (**ไม่ให้เลือก Section เอง**) | Must |
| AUTH-6 | Admin login ด้วย Google เช่นกัน และต้องมีอีเมลอยู่ในตาราง `admins` | Must |
| AUTH-7 | Session เก็บใน cookie แบบ HttpOnly | Must |

---

## 3. 🎮 GAME (2D ทั้งหมด)

| ID | เกม | กติกา | LO | ระดับ |
|---|---|---|---|---|
| GAME-1 | **Balloon Pop** | ลูกโป่งลอยขึ้นมาพร้อมคำ (ตำแหน่ง / หน้าที่ / โครงสร้าง / การควบคุม) แตะให้ตรงชนิดกล้ามเนื้อ (Skeletal / Cardiac / Smooth) มีเวลาจำกัด แสดงคะแนนท้ายเกม | OL1 | Must |
| GAME-2 | **Group Sort** | ลากโครงสร้างไปวางคู่กับ connective tissue (Epimysium / Perimysium / Endomysium) และแยกกลุ่ม structure vs connective tissue | OL2 | Must |
| GAME-3 | **Diameter Drag & Drop** | ลากเรียงโครงสร้างตามขนาดเส้นผ่านศูนย์กลาง 5 nm → 100 µm | OL3 | Must |
| GAME-4 | GAME-2 และ GAME-3 ใช้ **engine ลากวางตัวเดียว** ที่อ่านโจทย์จาก JSON | – | Must |
| GAME-5 | รองรับจอสัมผัส (มือถือ/แท็บเล็ต) และเมาส์ | – | Must |
| GAME-6 | แสดงเฉลย/คำอธิบายหลังจบเกม | – | Must |
| GAME-7 | บันทึกคะแนนเกมลง DB | – | Future |

---

## 4. 🧬 3D EXPLORE

| ID | Requirement | ระดับ |
|---|---|---|
| 3D-1 | หน้าเลือก **Topic หลัก** → กด หรือ zoom เข้า → เห็น **Sub-topic** (แนว BioDigital) | Must |
| 3D-2 | ลำดับ zoom ของ **Skeletal:** แขน/biceps → fascicle → muscle fiber → myofibril → **sarcomere** | Must |
| 3D-3 | เปลี่ยนระดับด้วยการ **บินกล้อง + fade** ระหว่าง scene | Must |
| 3D-4 | หมุน / zoom / pan ได้ด้วยนิ้วและเมาส์ | Must |
| 3D-5 | **Sarcomere:** สร้างด้วยโค้ด มี Z-disc, M-line, thin filament (actin, tropomyosin, troponin), thick filament (myosin) | Must |
| 3D-6 | **Slider หด ↔ คลาย** — I-band และ H-zone แคบลง, A-band และความยาว filament คงที่ (ตาม 01 §6.4) | Must |
| 3D-7 | **คลิกชิ้นส่วน → ป้ายชื่อ + info panel** (ชื่อ, หน้าที่) ครอบคลุม actin, myosin, tropomyosin, troponin, Z-disc, M-line, A/I/H | Must |
| 3D-8 | แสดงแถบ label A-band / I-band / H-zone บน sarcomere ให้เห็นการเปลี่ยนแปลง | Must |
| 3D-9 | ฝัง **Motion VDO** (YouTube `ousflrOzQHc`) ในหน้า sarcomere สำหรับลำดับ Ca²⁺ | Must |
| 3D-10 | Topic **หัวใจ** → cardiac muscle (intercalated disc) | Should |
| 3D-11 | Topic **smooth muscle** (กระเพาะ/หลอดเลือด → spindle cell) | Future |
| 3D-12 | แอนิเมชัน Ca²⁺ จาก SR ในโมเดล 3D | Future |
| 3D-13 | โมเดลร่างกายทั้งตัวเป็นหน้าเริ่มต้น | Future |
| 3D-14 | หน้า **Credits** แสดง license ของทุกโมเดล | Must |

---

## 5. 📝 TEST (Pretest / Posttest)

### 5.1 ฝั่งนักศึกษา

| ID | Requirement | ระดับ |
|---|---|---|
| TEST-1 | เห็นรายการข้อสอบที่เปิดให้ Section ตัวเอง พร้อมสถานะ (เปิด/ปิด, ทำแล้วกี่ครั้ง, เหลือกี่ครั้ง) | Must |
| TEST-2 | ทำข้อสอบแบบ Google Form: ทีละหน้าหรือเลื่อนยาว, นาฬิกานับถอยหลัง (ถ้ามีการจำกัดเวลา) | Must |
| TEST-3 | **บันทึกคำตอบอัตโนมัติ** — เน็ตหลุดหรือปิด tab แล้วกลับมาทำต่อได้ (ภายในเวลาที่เหลือ) | Must |
| TEST-4 | หมดเวลา → server ส่งอัตโนมัติด้วยคำตอบที่บันทึกไว้ | Must |
| TEST-5 | แสดงคะแนนหลังส่ง (จะให้เห็นเฉลยหรือไม่ Admin เป็นคนตั้ง) | Must |

### 5.2 ฝั่ง Admin — Test Builder (แบบ Google Form)

| ID | Requirement | ระดับ |
|---|---|---|
| BLD-1 | สร้างชุดข้อสอบ: ชื่อ, คำอธิบาย, ประเภท (Pretest / Posttest / อื่น ๆ) | Must |
| BLD-2 | ประเภทคำถาม: **ตัวเลือกเดียว, หลายตัวเลือก, ถูก/ผิด, ตอบสั้น** | Must |
| BLD-3 | กำหนด **เฉลย + คะแนนต่อข้อ + บังคับตอบ** | Must |
| BLD-4 | ลากเรียงลำดับข้อ, คัดลอกข้อ, ลบข้อ | Must |
| BLD-5 | **Preview** ในมุมนักศึกษา | Must |
| BLD-6 | บันทึกอัตโนมัติ | Must |
| BLD-7 | **ล็อกเวอร์ชัน:** เมื่อมีคนเริ่มทำแล้ว การแก้ไขจะสร้างเวอร์ชันใหม่ attempt เดิมอ้างอิงสำเนาข้อสอบ ณ ตอนเริ่มทำ | Must |
| BLD-8 | แนบรูปในโจทย์/ตัวเลือก (อัปโหลดไป R2) | Should |
| BLD-9 | สลับลำดับข้อ/ตัวเลือก | Should |
| BLD-10 | คำถามแบบจับคู่ (Grid / Matching) | Should |
| BLD-11 | นำเข้าข้อสอบจาก Excel/CSV template | Should |

### 5.3 ฝั่ง Admin — การตั้งค่าการสอบ (ต่อ Section)

| ID | Requirement | ระดับ |
|---|---|---|
| SET-1 | มอบหมายข้อสอบ 1 ชุดให้หลาย Section ได้ โดยแต่ละ Section ตั้งค่าแยกกัน | Must |
| SET-2 | **จำกัดเวลา** (นาที) หรือ **ไม่จำกัดเวลา** | Must |
| SET-3 | **ทำได้ครั้งเดียว** หรือ **ทำซ้ำได้** (กำหนดจำนวนครั้ง หรือไม่จำกัด) | Must |
| SET-4 | ถ้าทำซ้ำได้ เลือกว่านับคะแนน **สูงสุด / ล่าสุด / ครั้งแรก** | Must |
| SET-5 | กำหนดวัน–เวลาเปิดและปิด หรือเปิด/ปิดด้วยมือ | Must |
| SET-6 | ตั้งได้ว่าจะให้นักศึกษาเห็นเฉลยหลังส่งหรือไม่ | Must |

---

## 6. 👩‍🏫 ADMIN DASHBOARD

| ID | Requirement | ระดับ |
|---|---|---|
| ADM-1 | สร้าง/แก้ **Class** = ปีการศึกษา + เทอม + Section → ได้ **QR code + join code** ของ Section นั้น | Must |
| ADM-2 | ดูรายชื่อผู้เข้าร่วมของแต่ละ Section (Student ID, ชื่อต้น, เวลาเข้าร่วม) | Must |
| ADM-3 | ตารางคะแนน: แถว = นักศึกษา, คอลัมน์ = ข้อสอบแต่ละชุด **กรองตาม Section** | Must |
| ADM-4 | สถิติ: ค่าเฉลี่ย / SD / ต่ำสุด / สูงสุด ของ Pretest เทียบ Posttest, รายชื่อคนที่ยังไม่ทำ | Must |
| ADM-5 | วิเคราะห์รายข้อ (% ตอบถูกของแต่ละข้อ) | Should |
| ADM-6 | **Export Excel** 1 คลิก: Student ID, ชื่อต้น, Section, คะแนนแต่ละชุด (ทั้ง Section หรือทุก Section) | Must |
| ADM-7 | **ย้าย Section** ของนักศึกษา (คะแนนย้ายตาม) | Must |
| ADM-8 | นำเข้ารายชื่อ (roster CSV) — ให้เข้าได้เฉพาะ ID ที่อยู่ในรายชื่อ | Should (รอคำตอบ Q3) |

---

## 7. กฎการแยก Section (กันข้อมูลปนกัน)

1. **Class = ปีการศึกษา + เทอม + Section** เป็นศูนย์กลางของข้อมูลทั้งหมด
2. QR / join code **1 อันต่อ 1 Section** — สแกนแล้วผูกเข้า Section นั้นอัตโนมัติ
3. การสอบทุกครั้งผูกกับ **(นักศึกษา + Class + ข้อสอบ)**
4. Dashboard และ Export **กรองตาม Class เสมอ**
5. สแกน QR ผิด Section → Admin ใช้ **ย้าย Section** (ADM-7)

## 8. กฎการลบข้อมูลนักศึกษา (3 ระดับ)

| ระดับ | ใช้เมื่อ | ผล | ย้อนกลับได้ |
|---|---|---|---|
| 1. **Withdraw** | ดรอป / ไม่ได้เรียนแล้วกลางเทอม | ซ่อนจาก dashboard, ไม่นับค่าเฉลี่ย, login ไม่ได้ | ✅ |
| 2. **Archive Class** | จบเทอม | ทั้ง Section กลายเป็น read-only ซ่อนจากหน้าหลัก ยังดูและ export ย้อนหลังได้ | ✅ |
| 3. **Delete / Anonymize** | ครบระยะเก็บข้อมูล (ค่าเริ่มต้น 1 ปีหลัง Archive) หรือนักศึกษาขอลบตาม PDPA | ระบบ **บังคับ export ก่อน** → เลือก ลบทั้งหมด หรือ **ลบ ID + ชื่อ แต่เก็บคะแนนแบบไม่ระบุตัวตน** | ❌ |

- ระดับ 3 ต้องยืนยัน 2 ชั้น (พิมพ์ชื่อ Section เพื่อยืนยัน) — Should
- ทุกการลบ/ย้าย/withdraw บันทึกใน `audit_log` (ใคร, ทำอะไร, เมื่อไร)

---

## 9. Non-functional requirements (บังคับ)

| ID | Requirement |
|---|---|
| NFR-1 | ใช้บน browser ได้ทันที **ไม่ต้องติดตั้ง** — Chrome / Safari / Edge บนมือถือ แท็บเล็ต คอม |
| NFR-2 | Responsive ตั้งแต่จอกว้าง 360 px |
| NFR-3 | เป็นไปตาม **Performance budget** ใน [03_TECH_STACK.md](03_TECH_STACK.md) §4 |
| NFR-4 | รองรับ **~50 คนทำข้อสอบพร้อมกัน** ต่อ Section โดยไม่มีข้อมูลหาย |
| NFR-5 | ระบบต้อง**ไม่หลับ / ไม่ pause** เมื่อไม่มีคนใช้ (เหตุผลที่ไม่ใช้ Supabase free tier) |
| NFR-6 | ความปลอดภัย: เฉลยอยู่ที่ server เท่านั้น, ตรวจคำตอบที่ server, จับเวลาจากเวลา server, ตรวจสิทธิ์ admin ทุก API |
| NFR-7 | PDPA: เก็บเฉพาะ Student ID, ชื่อต้น, อีเมล lamduan · มีหน้าแจ้งการเก็บข้อมูล (privacy notice) |
| NFR-8 | ค่าใช้จ่าย: ใช้ free tier ทั้งหมด |
