# HRTA WebApp v35 — Bug audit & verification report

วันที่ตรวจ: 4 พฤศจิกายน 2026  
ฐานโปรเจกต์: v34 (`HRTA_webapp_v34_target_chariot_ui_fix.zip`)

## สรุปสิ่งที่แก้ไข

### 1. The Moon — เปิดไพ่ 2 เทิร์นเต็มของผู้ถูกเลือก

- เมื่อ Moon ทำงาน จะกำหนด `revealed` ไปยังผู้เล่นเป้าหมายและ `revealTurnsLeft = 2`.
- ระบบจะลดตัวนับเมื่อผู้เล่นเป้าหมายจบเทิร์นที่มีการลงไพ่จริง (`turnState.played > 0`) เท่านั้น.
- เทิร์นที่ลง Devil/Chariot หลายใบยังนับเป็นหนึ่งเทิร์น ไม่ได้นับแยกตามจำนวนไพ่.
- เทิร์นที่ถูก Empress ทำให้จั่วอย่างเดียวและข้าม ไม่ลดตัวนับ เพราะผู้เล่นไม่ได้ลงไพ่.
- มือที่เปิดเผยจะถูก Refresh หลังการเปลี่ยนแปลงมือ เพื่อให้ข้อมูลสาธารณะตรงกับไพ่ในมือจริง.
- ถ้าผู้ถูกเปิดมือออกจากเกม/ถูกคัดออก สถานะเปิดมือและตัวนับจะถูกล้าง.
- เพิ่มตัวเลข `🌙 เปิดมือ · เหลือ N ตา` บนที่นั่งของผู้เล่นเป้าหมาย.
- อัปเดตคำอธิบายพลัง Moon ในคู่มือออนไลน์/ออฟไลน์ให้ตรงกัน.

### 2. Desktop / Responsive layout

- `#onl` เป็น scroll container หลักทั้งแนวตั้งและแนวนอน รวมถึงหน้าต่าง Desktop ที่มีความสูงน้อย.
- ยกเลิก nested scroll ใน Avatar Picker ที่แย่งรับ wheel/touch จากหน้าหลัก.
- หน้าสร้างห้อง/เข้าห้องเป็นสองคอลัมน์บนหน้าจอกว้าง และกลับเป็นหนึ่งคอลัมน์บนมือถือ.
- ปุ่มสร้างห้อง/เข้าห้องเป็น sticky action bar เพื่อให้เรียกใช้งานได้ระหว่างเลื่อน.
- Lobby ใช้ 4 คอลัมน์เมื่อมีพื้นที่เพียงพอ.
- จำกัดขนาดโต๊ะเกมแนวตั้งบน Desktop/Tablet ตามทั้งความกว้างและความสูงของ viewport.
- PWA manifest ตั้ง `orientation: any` เพื่อให้หมุนจอได้.

## รายละเอียดฝั่ง Server / Database

- Public state เพิ่ม `revealTurnsLeft` และขยับ public-state version เป็น `v: 4`.
- รองรับ state เก่าที่ไม่มี counter โดยใช้ fallback แบบ backward-compatible.
- ไม่มีการเพิ่ม/เปลี่ยนคอลัมน์ SQL: ตัวนับอยู่ใน JSON `public_state` เดิม จึง **ไม่ต้องรัน SQL Migration ใหม่**.
- Build Edge Function ใหม่จาก source ด้วย `node tools/build-edge.js`.
- ต้อง Deploy Supabase Edge Function `nn-api` ใหม่ เพราะ logic การนับ Moon เปลี่ยนที่ authoritative server.

## ผลการตรวจอัตโนมัติ

- `node --test tests/*.test.js`: ผ่าน 5 test suites, 0 failures.
- API tests: รวม Star ±17, target selection, Chariot skip, Empress, timeouts, disconnects, concurrency และ full-game simulations.
- Engine tests: Moon 2 เทิร์นในเกม 2 คน, Devil multi-card counted once, Empress draw-only skip not counted, public/private state mapping, live hand refresh และ offline/shared-engine parity.
- Elimination simulation: 900 เกม / 1,350 mid-game eliminations.
- Full API games: 75 เกม / 1,514 plays.
- Edge wrapper tests: ผ่าน.
- `node --check`: JavaScript ใน `online/`, `tools/`, `tests/` ผ่าน.
- Extract inline scripts จาก `index.html`: ตรวจ syntax ผ่านทั้ง 6 inline scripts.
- `manifest.webmanifest`: JSON parse ผ่าน.
- Build `supabase/functions/nn-api/index.ts`: สำเร็จ.

## Responsive layout smoke test

ทดสอบ CSS/markup harness ด้วย Chromium ที่ viewport ต่อไปนี้:

| Viewport | Create/Join scroll + sticky action | Game table bounds |
|---|---|---|
| 1365×600 | ผ่าน | ผ่าน (short landscape) |
| 1365×768 | ผ่าน | ผ่าน |
| 1440×900 | ผ่าน | ผ่าน |
| 1920×1080 | ผ่าน | ผ่าน |
| 768×1024 | ผ่าน | ผ่าน |
| 390×844 | ผ่าน | ผ่าน |
| 390×600 | ผ่าน | ผ่าน (root remains scrollable) |
| 320×568 | ผ่าน | ผ่าน |
| 844×390 | ผ่าน | ผ่าน (landscape) |

ตรวจว่า wheel บน Avatar Picker เลื่อน outer `#onl`, ปุ่มหลักอยู่ในระยะมองเห็นหลัง scroll และไม่มี horizontal overflow.

## ข้อจำกัดที่ยังต้องตรวจในสภาพแวดล้อมจริง

- Responsive test ด้านบนเป็น component-level CSS/markup harness ไม่ใช่ end-to-end browser test ของหน้าเว็บที่ Deploy จริง.
- ยังไม่ได้เชื่อม Supabase Project จริงและทดสอบผู้เล่นสองเครื่องพร้อมกัน.
- การเข้าถึง `localhost`/หน้าเว็บจริงจาก Browser automation ถูก environment policy บล็อก จึงไม่สามารถยืนยันการคลิกครบทุกขั้นตอนใน UI จริงได้.

## Deployment

1. สำรอง v34.
2. Deploy ไฟล์เว็บไซต์ทั้งหมดจาก v35 ไปยัง GitHub Pages โดยรักษา path.
3. Deploy `supabase/functions/nn-api/index.ts` เป็น Edge Function `nn-api` ใหม่.
4. ไม่ต้องรัน SQL Migration เพิ่ม.
5. ตรวจว่า `sw.js` เป็น `v35` แล้ว reload/clear cache.
6. ทดสอบ Moon ในห้อง 2 คน: หลังเล่น Moon ควรเห็นมือเป้าหมายพร้อมตัวนับ 2 → 1 → หาย หลังเป้าหมายจบเทิร์นที่ลงไพ่จริงครบสองครั้ง.
