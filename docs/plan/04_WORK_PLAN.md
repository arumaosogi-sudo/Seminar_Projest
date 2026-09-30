# 04 — Work Plan (แผนการดำเนินงาน)

## 1. ตารางวิชา (1305394 Seminar in Software Engineering)

| ครั้ง | วันที่ | หัวข้อ |
|---|---|---|
| 1–6 | 6 ส.ค.–10 ก.ย. | Course intro, proposal writing, AI-assisted presentation, academic paper, stakeholder topics |
| 7–8 | 17–24 ก.ย. | Project proposal presentation |
| – | (หลัง 24 ก.ย.) | **Midterm** |
| 9 | 8 ต.ค. | Grace period for proposal document |
| 10 | 15 ต.ค. | Group work — problem formalisation |
| 11 | 22 ต.ค. | Group work — literature review |
| 12 | 29 ต.ค. | Group work — **prototype** |
| 13 | 5 พ.ย. | Group work — **evaluation** |
| 14 | 12 พ.ย. | **Final Presentation** |
| 15 | 19 พ.ย. | **Final Paper submission** |

## 2. บทบาท

| บทบาท | รับผิดชอบ | ผู้รับผิดชอบ |
|---|---|---|
| **A — Backend / Test / Admin** | Worker API, D1, Auth, Test engine, Test Builder API, Dashboard, Export, จัดการนักศึกษา | _(ทีมกำหนด)_ |
| **B — UI / Games** | Design system, Login/Home, 3 เกม, **Test Builder UI**, หน้าทำข้อสอบ | _(ทีมกำหนด)_ |
| **C — 3D** | โมเดล 3D, zoom chain, Sarcomere + slider, info panel, credits | _(ทีมกำหนด)_ |
| **ทุกคน** | Paper, evaluation, presentation, code review ของกันและกัน | ทุกคน |

## 3. Timeline

| ช่วง | วันที่ | งานวิชา | A: Backend / Test / Admin | B: UI / Games | C: 3D | Paper | ✅ ต้องได้ |
|---|---|---|---|---|---|---|---|
| **Phase 0: Setup** | 25 ก.ย.–7 ต.ค. | Midterm | Repo, Pages + Worker + D1 deploy, ERD + schema, CI | Wireframe ทุกหน้า, design token | ทดลอง sarcomere + slider บนมือถือจริง, คัดโมเดลจาก Z-Anatomy/Sketchfab + ตารางเครดิต | แก้ Proposal | เว็บเปล่าที่ deploy แล้ว + ผลทดลอง 3D (fps) |
| **Phase 1: Foundation** | 8–14 ต.ค. (W9) | ส่ง Proposal | Google login + ตรวจ domain, session, QR join, Admin auth | Login, Onboarding, Home, ระบบนำทาง | ป้ายชื่อโปรตีนที่คลิกได้ + info panel | ส่ง Proposal doc | สแกน QR → login → Home ได้ |
| **Phase 2: Core build** | 15–21 ต.ค. (W10) | Problem formalisation | API ข้อสอบ + ตรวจคำตอบ + ล็อกเวอร์ชัน + จับเวลา | **Test Builder UI** (4 ประเภทคำถาม) + หน้าทำข้อสอบ + **Balloon Pop** | Zoom chain (บินกล้อง + fade) | Requirement spec, use case, ERD, performance budget | Admin สร้างข้อสอบ → นักศึกษาทำ → คะแนนเข้า DB |
| | 22–28 ต.ค. (W11) | Literature review | ตั้งค่าการสอบ, Dashboard, **Export Excel**, Withdraw/Archive/ย้าย Section | engine ลากวาง → **Group Sort + Diameter** | fiber → myofibril → sarcomere ต่อกันครบ | Lit review | Export Excel แยกตาม Section ได้ |
| **Phase 3: Prototype** | 29 ต.ค.–4 พ.ย. (W12) | **Prototype** | หยุดเพิ่มฟีเจอร์ 1 พ.ย., ใส่ข้อสอบจริง, QR จริง · Should: อัปโหลดรูป / สลับข้อ / นำเข้า CSV / Anonymize | ปรับ UI, info panel · Should: Matching | ปรับประสิทธิภาพมือถือ · Should: Topic หัวใจ | บท Design & Implementation | 🎯 **Prototype ครบทุกเมนู deploy แล้ว** |
| **Phase 4: Evaluation** | 5–11 พ.ย. (W13) | **Evaluation** | Load test ~50 คนพร้อมกัน, แก้ bug | แก้ bug UI | แก้ bug 3D | ทดสอบผู้ใช้: pre/post + SUS + Lighthouse + อาจารย์ทดลองใช้ | ผลประเมินพร้อมเขียน Results |
| **Phase 5: Present** | 12 พ.ย. (W14) | **Final Presentation** | ← ทุกคน: สไลด์ + demo สด | ← | ← | บท Results | 🎤 นำเสนอ |
| **Phase 6: Paper** | 13–19 พ.ย. (W15) | **Final Paper** | – | – | – | Discussion, Future Work, ตรวจทาน | 📄 ส่ง Paper |

## 4. จุดเช็กความคืบหน้า (ไม่ใช่จุดตัดงาน — ตามข้อบังคับ R10)

| วันที่ | เช็กอะไร | ถ้าล่าช้า |
|---|---|---|
| 7 ต.ค. | 3D บนมือถือลื่นแค่ไหน (fps) | แจ้งทีม ทำต่อครบตามแผน ปรับทีหลัง |
| 22 ต.ค. | Test + Dashboard คืบหน้าแค่ไหน | แจ้งทีม ช่วยกันเกลี่ยงาน |
| 1 พ.ย. | ฟีเจอร์ Must ครบหรือยัง | ส่วนที่ค้างทำต่อควบคู่กับ Evaluation |

> ข้อควรระวัง: ถ้างานล่าช้าหลัง 1 พ.ย. เวลาที่ถูกเบียดคือสัปดาห์ Evaluation ซึ่งต้องใช้ผลไปเขียน paper → **แจ้งทีมทันทีที่รู้ว่าล่าช้า**

## 5. แผน Evaluation (W13)

| วัดอะไร | เครื่องมือ | เกณฑ์ |
|---|---|---|
| ผลการเรียนรู้ | Pretest → ใช้เว็บ → Posttest (ข้อสอบชุดเดียวกับของเดิม) | Posttest สูงกว่า Pretest อย่างมีนัยสำคัญ (paired t-test) |
| ความใช้งานง่าย | **SUS** (System Usability Scale) 10 ข้อ | ≥ 68 |
| ความพึงพอใจ | แบบประเมินเดิมของ Key Point Book (Likert 5 ระดับ) | เทียบกับผลปี 63–64 |
| ประสิทธิภาพ | Lighthouse, ขนาด bundle, fps | ตาม 03 §4 |
| ความทนทาน | Load test ~50 คนพร้อมกัน | ไม่มีข้อมูลหาย, p95 < 300 ms |
| ความถูกต้องทางวิชาการ | อาจารย์ผู้เสนอโจทย์ตรวจ | ผ่านการตรวจ |

## 6. สิ่งที่ต้องได้จากอาจารย์ (ดู README → Open Issues)

| สิ่งที่ต้องได้ | ต้องได้ก่อน |
|---|---|
| คำตอบว่าจะทำข้อสอบแบบกลุ่มหรือไม่ (Q4) | W10 (15 ต.ค.) |
| กลุ่มผู้ใช้สำหรับ Evaluation (Q2) + เรื่อง roster (Q3) | W11 (22 ต.ค.) |
| **เฉลยข้อสอบ + รูปประกอบ** (Q1) | W12 (29 ต.ค.) |

## 7. วิธีทำงานร่วมกัน
- **Git:** branch `main` = production · ทำงานใน `feat/<ชื่อ>` → Pull Request → เพื่อนรีวิวอย่างน้อย 1 คน → merge
- **Deploy:** merge เข้า `main` → GitHub Actions deploy ขึ้น Cloudflare อัตโนมัติ · ทุก PR มี preview URL
- **ประชุม:** สั้น ๆ สัปดาห์ละ 2 ครั้ง (ต้นสัปดาห์วางงาน / ปลายสัปดาห์เช็ก "✅ ต้องได้")
- **เปลี่ยนแผน/ขอบเขต:** ตกลงกันทั้งทีม → บันทึกใน Change log ของ [README.md](README.md)
