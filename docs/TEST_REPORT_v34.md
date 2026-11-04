# HRTA WebApp v34 — Online Target Choice & Chariot Audit

วันที่ตรวจ: 4 พฤศจิกายน 2026

## อาการที่แก้

1. **Fool / Emperor / Moon:** ปุ่มเลือกเป้าหมายผูก `data-card-id` และส่ง `choice.target` พร้อม Card ID ใน action เดียวกัน ลดการพึ่ง `M.sel` ที่เป็น client selection state; **Empress:** ปุ่มแทรกผูก Card ID ของ Empress โดยตรง
2. **เกมเหลือ 2 คน:** UI แสดงปุ่มฝ่ายตรงข้ามแบบเลือกอัตโนมัติให้ชัดเจน สำหรับ Fool, Emperor และ Moon แทนปุ่มพลังทั่วไปที่ดูเหมือนไม่มีขั้นตอนเลือก
3. **Chariot:** ปุ่มข้ามไม่ถูกซ่อนระหว่าง animation / request; แสดงค้างใน pending state และ disable ชั่วคราวจนกว่าระบบพร้อมรับ action ปุ่มลงใบที่สองผูกกับ Card ID เช่นกัน
4. **ตัวเลือกทั่วไป:** ปุ่ม `nopt` และ `nsealed` ส่ง Card ID แบบ explicit เพื่อป้องกัน action ไปใช้การ์ดคนละใบหลัง UI update
5. **Service Worker:** เปลี่ยนเป็น `v34` เพื่อบังคับรับไฟล์ online UI ที่แก้ไขแล้ว

## ผลการทดสอบอัตโนมัติ

- `node tests/engine-parity.test.js` — ผ่าน
- `node tests/api.test.js` — ผ่าน: Star ±17, target mapping ของ Fool / Emperor / Moon ใน 3 คน, automatic target ใน 2 คน, Chariot skip ผ่าน API, deadline, concurrency, timeout, forfeit และ full API games
- `node tests/elimination.test.js` — ผ่าน: 900 เกมจำลอง
- `node tests/edge-wrapper.test.js` — ผ่าน
- `node tests/ui-choice-contract.test.js` — ผ่าน: ตรวจ target button/Card ID, explicit action binding, 2-player target prompt และ Chariot skip visibility contract
- `node --check` — ผ่านสำหรับไฟล์ JavaScript ที่แก้ไขและส่วน online
- `python3 -m py_compile tests/e2e.test.py` — ผ่าน
- `node tools/build-edge.js` — ผ่าน (Edge Function bundle ประมาณ 48 KB; source server/engine/API ไม่มีการเปลี่ยนแปลง)

## ยังไม่ได้ยืนยัน

- **Browser E2E จริง:** เพิ่ม Playwright scenarios สำหรับ Fool / Emperor / Moon target, Emperor seal และ Chariot ทั้งลงใบที่สองและข้ามแล้ว แต่ Chromium ในสภาพแวดล้อมนี้บล็อกทั้ง `localhost` และ `file://` ด้วย `ERR_BLOCKED_BY_ADMINISTRATOR`; จึงไม่ถือว่าการคลิก UI ผ่าน Browser ได้รับการยืนยัน
- **Supabase จริง / Realtime / RLS:** ไม่ได้เชื่อมและทดสอบกับ Project Supabase ของผู้ใช้
- **มือถือจริง:** ยังต้องทดสอบ iPhone Safari และ Android Chrome

## Deploy

- ไม่มี SQL Migration ใหม่ และไม่ต้อง Deploy Edge Function ใหม่สำหรับแพตช์นี้ เพราะแก้เฉพาะ online UI, CSS, tests และ Service Worker
- อัปโหลดไฟล์ทั้งหมดจาก v34 โดยคงโครงสร้างโฟลเดอร์ แล้วตรวจ `sw.js` ว่าเป็น `v34`
- หาก Edge Function ที่ใช้งานอยู่ไม่ใช่ v33 build ที่ตรงกับ package ก่อนหน้า ให้ตรวจ source/deployed revision แยกต่างหาก
