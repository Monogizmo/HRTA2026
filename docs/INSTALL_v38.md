# ติดตั้ง / อัปเกรดเป็น HRTA WebApp v38

v38 = v37 (Moon/Sun) + สงครามไพ่ 2 โหมด (วัดดวง/ยุทธวิธี, ออฟไลน์+ออนไลน์) + แก้ไอคอนบนคอม + Quiz Leaderboard

## A) ใช้แบบออฟไลน์อย่างเดียว (ไม่ต้องมี Supabase)
1. แตก ZIP แล้วอัปโหลดไฟล์ **ทั้งโฟลเดอร์** ขึ้นโฮสต์เดิม (GitHub Pages ฯลฯ) ทับของเก่า — มีไฟล์ใหม่ `emoji-fix.js`, `online/online-war.js`
2. เปิดเว็บแล้วกด Hard Refresh (Ctrl+Shift+R) หนึ่งครั้ง — Service Worker เปลี่ยนเป็น `v38` จะล้างแคชเก่าให้เอง
3. ใช้ได้ทันที: สงครามไพ่ → เลือก 🎲 วัดดวง / 🧠 ยุทธวิธี (เล่นกับโคลนน้องเบสท์) · แท็บ Quiz มีอันดับ "เครื่องนี้" · ไอคอนเหรียญแก้แล้ว

## B) เปิดออนไลน์ (สงครามไพ่ + เลขเพดาน) และอันดับ Quiz ทั้งทีม
ถ้าติดตั้งโหมดออนไลน์ของ v37 ไว้แล้ว (migration 001–005, Edge Function `nn-api`, ไฟล์ `online/config.js`) ให้ทำเพิ่ม 3 ขั้น:
1. **รัน SQL ใน Supabase → SQL Editor ตามลำดับ:** `supabase/migrations/006_war_online.sql` แล้ว `supabase/migrations/007_quiz_leaderboard.sql` (ห้ามข้าม 005; รันซ้ำได้ปลอดภัย)
2. **สร้าง Edge Function ใหม่:** บนเครื่องที่มี Node: `node tools/build-edge.js` → เอาไฟล์ `supabase/functions/nn-api/index.ts` ไปวางทับฟังก์ชัน `nn-api` เดิมใน Dashboard แล้ว Deploy (ไม่ต้องตั้ง secret เพิ่ม) — หรือใช้ไฟล์ที่ build ไว้ใน ZIP แล้วอยู่ที่พาธเดียวกัน
3. อัปโหลดเว็บ (ข้อ A) แล้วทดสอบด้วยมือถือ 2 เครื่องตามรายการใน `docs/README.md` ข้อ 10 — **SQL/Edge ใหม่ยังไม่เคยรันกับ Supabase จริง ทดสอบก่อนใช้งานจริง**

ถ้ายังไม่เคยติดตั้งโหมดออนไลน์ ให้ทำตาม `docs/README.md` ข้อ 2 ก่อน (001–005 → Edge Function → `online/config.js`) แล้วค่อยทำข้อ B

## C) ทดสอบด้วยตัวเอง (ไม่บังคับ)
```
node tools/build-edge.js
for t in engine-parity api elimination edge-wrapper engine-cards war-engine war-parity war-legacy war-api; do node tests/$t.test.js; done
python3 -m http.server 8765        # อีกหน้าต่างหนึ่ง แล้วรัน (ต้องมี playwright):
python3 tests/e2e.test.py ; python3 tests/offline-e2e.test.py
python3 tests/e2e-war-offline.test.py ; python3 tests/e2e-war.test.py ; python3 tests/e2e-war-2ctx.test.py ; python3 tests/e2e-quiz.test.py
```
