# HRTA WebApp v33 — Test & Bug Audit Report

วันที่ตรวจ: 4 พฤศจิกายน 2026

## ประเด็นที่แก้ไข

1. **The Star ออนไลน์ (+17 / −17):** ปุ่มแต่ละทางเลือกส่ง `card_id` ของไพ่ที่เลือกไปพร้อมค่า `choice.value` โดยตรง ไม่พึ่ง selection state ที่อาจเปลี่ยนระหว่าง render และคืน selection ให้ผู้เล่นลองใหม่เมื่อ API ปฏิเสธคำขอ
2. **Emperor seal:** เมื่อผู้เล่นถูกผนึก UI ออนไลน์แสดงเฉพาะปุ่มลงไพ่ตามเลขหน้าไพ่ ไม่แสดงเมนูพลังพิเศษ/ตัวเลือก ±17
3. **แนวนอนและเต็มจอ:** เพิ่มปุ่มเต็มจอ/แนวนอนสำหรับเกม 2 คนด้วย (เดิมมีเฉพาะบางจำนวนผู้เล่น) และ CSS ใช้พื้นที่จอแนวนอนมากขึ้น
4. **ตัวจับเวลา:** Action ย่อยที่ยังเป็นเทิร์นของผู้เล่นเดิมไม่รีเซ็ตเวลา 60 วินาที; เมื่อเปลี่ยนผู้เล่นจึงเริ่มเวลาใหม่
5. **ความสอดคล้องของ Edge Function:** Build `supabase/functions/nn-api/index.ts` จาก source ปัจจุบันด้วย `node tools/build-edge.js` แล้ว

## ผลการทดสอบที่ผ่าน

- `node tests/engine-parity.test.js` — ผ่าน: inline/shared engine parity และกรณี Tarot สำคัญ
- `node tests/api.test.js` — ผ่าน: Star −17/+17 ผ่าน Online API ถึง authoritative engine, deadline ของ Chariot/Empress, concurrency, timeout, forfeit และ full API games
- `node tests/elimination.test.js` — ผ่าน: 900 เกมจำลอง, 1,350 การคัดออกระหว่างเกม, ตรวจ turn order และ card conservation
- `node tests/edge-wrapper.test.js` — ผ่าน: CORS, JWT, bad JSON/action และ method checks
- `node --check` — ผ่านสำหรับ JavaScript ใน `online/`, `tests/`, E2E mock และ `sw.js`
- `python3 -m py_compile tests/e2e.test.py` — ผ่าน
- `node tools/build-edge.js` — ผ่าน; สร้าง Edge Function bundle ขนาดประมาณ 48 KB

## ยังไม่ได้ยืนยัน

- Browser E2E: พยายามรัน Playwright กับ Chromium และ local HTTP server แล้ว แต่ environment นี้ปฏิเสธการนำทางไป `localhost` ด้วย `net::ERR_BLOCKED_BY_ADMINISTRATOR` จึงยังไม่ถือว่า UI E2E ผ่าน ต้องรัน `python3 tests/e2e.test.py` บนเครื่องที่อนุญาตให้ Chromium เปิด localhost
- Supabase จริง: ยังไม่ได้รัน Migration 005 หรือ Deploy Edge Function v33 ในโปรเจกต์จริง และยังไม่ได้ทดสอบ RLS/Realtime กับห้องจริง
- อุปกรณ์จริง: ยังต้องทดสอบ iPhone Safari และ Android Chrome; อุปกรณ์ที่ไม่รองรับ `screen.orientation.lock()` ต้องหมุนเครื่องเองหลังเปิดเต็มจอ

## ขั้นตอนก่อนเปิดให้เล่นจริง

1. สำรองเวอร์ชันก่อนหน้า
2. ตรวจว่า Migration 001–005 ถูกใช้ตามลำดับแล้ว; v33 ไม่มี Migration ใหม่เพิ่มจาก v31
3. Deploy `supabase/functions/nn-api/index.ts` ที่อยู่ในแพ็กเกจนี้ไปยัง Edge Function `nn-api`
4. อัปโหลดไฟล์หน้าเว็บทั้งหมด โดยรักษาโครงสร้างโฟลเดอร์เดิม
5. เปิด `sw.js` ตรวจ `VERSION = "v33"` แล้วล้าง/รีเฟรช Service Worker
6. ทดสอบโต๊ะจริง 2, 3 และ 4 คน โดยเน้น Star ทั้งสองค่า, Star ขณะถูก Emperor ผนึก, เต็มจอแนวนอน, Chariot, Devil, Sun และ Empress

