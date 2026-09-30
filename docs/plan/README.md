# 📘 Plan for Work — Digital Muscle Learning Project (ข้อบังคับของโปรเจกต์)

| หัวข้อ | รายละเอียด |
|---|---|
| **ชื่อโปรเจกต์** | Web Games and Virtual Muscle Model (Digital Muscle Learning Project) |
| **วิชา** | 1305394 Seminar in Software Engineering |
| **ทีม** | MedicSync — 3 คน (user, PUNTHITA PAKDEE, PATIPHAT LUANOI) · อาจารย์ที่ปรึกษา: อ.ทิว (Tew Hongthong) |
| **ผู้เสนอโจทย์** | Asst. Prof. Dr. Keerakarn Somsuan (MFU) — เจ้าของ Key Point Book |
| **เวอร์ชัน** | v1.0 · 25 ก.ย. 2026 |
| **สถานะ** | ✅ ใช้บังคับ (Binding) |

> เอกสารในโฟลเดอร์นี้คือ **ข้อบังคับ** ของโปรเจกต์ สมาชิกทุกคนและ AI agent ทุกตัวต้องอ่านและปฏิบัติตามก่อนเริ่มงานใด ๆ
> ถ้าเอกสารอื่น (brief, สไลด์, แชต) ขัดกับโฟลเดอร์นี้ **ให้ยึดโฟลเดอร์นี้** จนกว่าจะแก้ไขผ่าน Change log ด้านล่าง

---

## 📂 เอกสารในโฟลเดอร์

| ไฟล์ | เนื้อหา | ใช้ตอบคำถาม |
|---|---|---|
| [01_PROJECT_OVERVIEW.md](01_PROJECT_OVERVIEW.md) | ที่มา ปัญหา กลุ่มผู้ใช้ Learning Outcomes เนื้อหาวิชาการ ข้อมูลเดิม | "โปรเจกต์นี้คืออะไร / สอนเรื่องอะไร" |
| [02_REQUIREMENTS.md](02_REQUIREMENTS.md) | ขอบเขต ฟีเจอร์ทุกเมนู user flow กฎทางธุรกิจ (Section, ข้อสอบ, ลบข้อมูล) | "ต้องทำอะไร / ทำงานอย่างไร" |
| [03_TECH_STACK.md](03_TECH_STACK.md) | Stack ร่วม Stack รายหน้า Data model API Performance budget แหล่งโมเดล 3D | "ใช้อะไรทำ / ทำอย่างไร" |
| [04_WORK_PLAN.md](04_WORK_PLAN.md) | Timeline รายสัปดาห์ การแบ่งบทบาท จุดเช็กความคืบหน้า สิ่งที่ต้องขอจากอาจารย์ | "ทำเมื่อไร / ใครทำ" |

---

## ⚖️ ข้อบังคับหลัก (Core Rules)

| # | ข้อบังคับ |
|---|---|
| R1 | **ขอบเขต** ทำตาม [02_REQUIREMENTS.md](02_REQUIREMENTS.md) เท่านั้น การเพิ่ม/ตัดฟีเจอร์ต้องตกลงกันทั้งทีมและบันทึกใน Change log |
| R2 | **Stack** ใช้ตาม [03_TECH_STACK.md](03_TECH_STACK.md) ห้ามเพิ่ม framework/library ใหม่โดยไม่ตรวจว่าไม่เกิน Performance budget |
| R3 | **Performance budget** เป็นข้อบังคับ ไม่ใช่ข้อแนะนำ — ทุก PR ต้องไม่ทำให้ขนาด bundle เกินเกณฑ์ |
| R4 | **ความปลอดภัยของข้อสอบ** เฉลยอยู่ที่ server เท่านั้น · ตรวจคำตอบที่ server · จับเวลาจากเวลา server · ตรวจ domain `lamduan.mfu.ac.th` ที่ server |
| R5 | **PDPA** เก็บเฉพาะ Student ID, ชื่อต้น, อีเมล lamduan · การลบข้อมูลต้องทำตามกระบวนการ 3 ระดับใน 02 |
| R6 | **ความถูกต้องทางวิชาการ** เนื้อหาทุกชิ้น (เกม, 3D, ข้อสอบ) ต้องตรงกับ Key Point Book / ตำราอ้างอิง และให้อาจารย์ผู้เสนอโจทย์ตรวจก่อนใช้จริง |
| R7 | **License โมเดล 3D** ทุกโมเดลที่นำมาใช้ต้องลงตารางเครดิตทันที (ชื่อ, ผู้สร้าง, ลิงก์, license) |
| R8 | **ไม่ต้องติดตั้งอะไร** ผู้ใช้เข้าผ่าน browser บนมือถือ/แท็บเล็ต/คอมได้ทันทีจาก QR code |
| R9 | **ภาษา UI** เป็นภาษาอังกฤษ (ตรงกับเนื้อหาและข้อสอบต้นฉบับ) |
| R10 | **ไม่มี hard cut-off** ทำครบทุกส่วนตามแผน ถ้าเกิดปัญหาให้แก้/ปรับทีหลัง แต่ต้องแจ้งทีมทันทีที่รู้ว่าล่าช้า |

---

## ❓ เรื่องที่ยังรอคำตอบ (Open Issues)

| # | เรื่อง | ถามใคร | ต้องได้ก่อน |
|---|---|---|---|
| Q1 | เฉลยข้อสอบ + รูปประกอบข้อสอบ (Google Form เดิม) | ผศ.ดร.กีรกานต์ | W12 (29 ต.ค.) |
| Q2 | กลุ่มผู้ใช้สำหรับสัปดาห์ Evaluation (5 พ.ย.) — มีคลาสจริงหรือต้องใช้อาสาสมัคร | ผศ.ดร.กีรกานต์ / อ.ทิว | W11 (22 ต.ค.) |
| Q3 | ต้องมีการนำเข้ารายชื่อ (roster) แต่ละ Section หรือเปิดให้ทุกคนที่มีอีเมล lamduan | ผศ.ดร.กีรกานต์ | W11 |
| Q4 | ต้องมีข้อสอบแบบทำเป็นกลุ่ม (แบบปี 65) หรือไม่ — แผนปัจจุบัน: รายบุคคล | ผศ.ดร.กีรกานต์ | W10 |
| Q5 | ยืนยันรูปแบบอีเมลนักศึกษา `รหัสนักศึกษา@lamduan.mfu.ac.th` | ทีม | W9 |
| Q6 | ไฟล์ response ของ Pretest ปี 65 (ถ้าจะใช้เทียบใน paper) | ผศ.ดร.กีรกานต์ | W13 |

---

## 📝 Change log

| วันที่ | เวอร์ชัน | เปลี่ยนอะไร | ใครอนุมัติ |
|---|---|---|---|
| 2026-09-25 | v1.0 | สร้างเอกสารชุดแรก: เนื้อหา, requirement, stack (Cloudflare แทน Supabase), แผนงานหลัง Midterm | ทีม MedicSync |

---

## 📎 แหล่งข้อมูลต้นทาง
- ข้อมูลดิบ: `C:\Seminar\ทำความเข้าใจเนื้อหาของproject\` (Key Point Book PNG 3 หน้า, วิดีโอ 8 คลิป, Quiz xlsx 7 ไฟล์)
- Project brief ของอาจารย์: https://digital-muscle-project.my.canva.site/
- เอกสารทีม: `Muscular System Educational Presentation.pdf` (สไลด์ 8 หน้า), `Web Games and Virtual Muscle Model.pdf` (6 หน้า)
- สรุปละเอียด + transcript วิดีโอ: `C:\board-claude\docs\PROJECT_CONTEXT.md`, `C:\board-claude\docs\knowledge\`
