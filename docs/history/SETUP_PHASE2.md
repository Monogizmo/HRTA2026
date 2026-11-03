# Phase 2 — เล่นไพ่จริง (ตามลำดับ)

> ต้องทำ Phase 1 (SQL 001 + เปิด Anonymous sign-ins) ให้เสร็จก่อน

## A. Supabase

1. **SQL Editor** → New query → วางไฟล์ `supabase/migrations/002_phase2_gameplay.sql` → Run (ควรขึ้น Success)
   - ไฟล์นี้ลบฟังก์ชัน `nn_start_game` ของ Phase 1 ทิ้ง (การเริ่มเกมต้องผ่าน Edge Function เพราะต้องแจกไพ่)
2. **Edge Functions** → Deploy a new function (Via Editor) → ตั้งชื่อ **`nn-api`** (ต้องตรงตัวอักษร)
   → ลบโค้ดตัวอย่างทั้งหมด → วางเนื้อหาทั้งไฟล์ `supabase/functions/nn-api/index.ts` → Deploy
3. ตั้งค่าของฟังก์ชัน `nn-api`: ปิด **Verify JWT with legacy secret** (หรือชื่อใกล้เคียง)
   เหตุผล: โค้ดตรวจ JWT ของผู้เล่นเองด้วย `auth.getUser(token)` อยู่แล้ว และการเปิดตัวตรวจของ gateway อาจชนกับระบบ API key แบบใหม่ (`sb_publishable_…`)
4. ไม่ต้องตั้ง secret เพิ่ม: `SUPABASE_URL` และ `SUPABASE_SERVICE_ROLE_KEY` ระบบใส่ให้ Edge Function เอง (ห้ามนำไปใส่ใน GitHub)
   - ถ้าโปรเจกต์ของคุณปิด legacy key แล้ว ให้สร้าง secret key ใหม่ แล้วเพิ่ม secret ชื่อ `SB_SECRET_KEY` ใน Edge Function (โค้ดอ่านตัวนี้ก่อน)
   - ถ้าจะทดสอบจากโดเมนอื่น ให้เพิ่ม secret `ALLOWED_ORIGINS` (คั่นด้วยจุลภาค) ค่าเริ่มต้นคือ `https://monogizmo.github.io`

## B. GitHub

อัปโหลดทับ/เพิ่ม (แตก ZIP ก่อน): `index.html`, `sw.js` (v28), `online/` (ไฟล์ใหม่: `nn-engine.js`, `online-game.js`, + ที่แก้: `online.js`, `online.css`),
`supabase/` และ `docs/` — แล้วตรวจ `.../sw.js` ว่าเป็น `v28` และล้างแคช

## C. ทดสอบด้วยเครื่องจริง (2–4 เครื่อง) — เกณฑ์ผ่าน Phase 2

1. สร้างห้อง เลือกโหมด **แพ้ 1 คน** → ทุกคนเข้าห้อง กด พร้อม → Host กด เริ่มเกม
2. ทุกเครื่องต้องเห็นกองกลาง/เพดาน/ตาของใคร **เหมือนกัน** แต่ละเครื่องเห็นเฉพาะไพ่ในมือตัวเอง (คนอื่นเห็นแค่จำนวน)
3. ลงไพ่นอกตาไม่ได้ · ถูกบังคับ (⛓️) ต้องลงใบสูงสุด (ใบอื่นขึ้น 🔒) · กดลงสองครั้งรัว ๆ ต้องลงใบเดียว
4. ลองไพ่พิเศษให้ครบ (ย้อนทิศ ข้ามคน ริบไพ่ สลับมือ ลง 2 ใบ ทุกคนล้างไพ่ ฯลฯ) ผลต้องตรงกับโหมดเล่นกับ AI
5. มีคนทำกองเกิน → ทุกเครื่องขึ้นหน้าผลลัพธ์: คนแพ้ + ผู้ชนะ (ที่เหลือ) + สถิติ
6. Host กด **เล่นอีกครั้ง** → ทุกคนกลับล็อบบี้ → กด พร้อม ใหม่ → เริ่มรอบที่ 2
7. (ตรวจความปลอดภัย) เปิด DevTools ของเครื่อง A แล้วลองอ่านตาราง `player_private_states`/`game_secrets` ของคนอื่น — ต้องไม่ได้ข้อมูล

## D. ที่ยังไม่มี (ตามแผน)
- **ยังไม่มี timeout / ตัดคนหลุด (Phase 3):** ถ้ามีคนออกหรือหลุดตอนถึงตาเขา เกมจะค้าง ให้ Host กด “ปิดห้อง”
- โหมด **คัดออก** ยังเลือกไม่ได้ (ปุ่มเทา)
- ยังไม่มีรางวัลเหรียญออนไลน์ · เอฟเฟกต์/เสียงแบบเกมเดิมจะทำใน Phase 4

## E. ทดสอบอัตโนมัติ (สำหรับผู้พัฒนา)
```
node tests/engine-parity.test.js   # engine แยก = engine เดิมใน index.html ตรงกันทุกตา (1,080 เกม) + กติกาเซิร์ฟเวอร์
node tests/api.test.js             # แกน Edge Function กับฐานข้อมูลจำลอง (กันซ้ำ/กันชน/เล่นจนจบ)
node tests/edge-wrapper.test.js    # CORS / ตรวจ JWT ของตัวห่อ Deno
node tools/build-edge.js           # รวมไฟล์เป็น supabase/functions/nn-api/index.ts (ทำใหม่ทุกครั้งที่แก้ online/nn-*.js)
python3 tests/e2e.test.py          # เล่นครบเกมใน Chromium (ต้องเปิด python3 -m http.server 8765 และมี playwright)
```
ข้อจำกัด: เทสต์ทั้งหมดใช้ฐานข้อมูล/Supabase จำลอง — **SQL 002 และ Edge Function ยังไม่เคยรันบน Supabase จริง**
