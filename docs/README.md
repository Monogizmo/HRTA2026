# HRTA WebApp — โหมดออนไลน์ (เกมเลขเพดาน 2–4 คน) · คู่มือฉบับสมบูรณ์

โหมดเดิมทั้งหมด (เล่นกับ AI / ส่งเครื่องกัน / เกมอื่น ๆ) ยังทำงานเหมือนเดิม โหมดออนไลน์เป็นปุ่มเพิ่มในหน้าตั้งค่าเกมเลขเพดาน

## 1) ภาพรวม
```
มือถือ 2–4 เครื่อง (GitHub Pages: index.html + online/*.js)
   │ HTTPS  → Edge Function `nn-api`  (เริ่มเกม / ลงไพ่ / ตรวจหมดเวลา / ยอมแพ้)   ← ผู้ตัดสิน รันกติกาและสุ่มไพ่
   │ WebSocket → Supabase Realtime   (ห้อง / สถานะเกม / มือของตัวเอง)
   ▼
Supabase: Auth (anonymous) · Postgres + RLS · Edge Function · Realtime
```
- เซิร์ฟเวอร์เป็นผู้ตัดสินทุกอย่าง client ส่งแค่ "ขอลงไพ่ใบนี้" ; สำรับ/กองทิ้งอ่านไม่ได้ ; มือคนอื่นอ่านไม่ได้ (RLS)
- เกมเลขเพดานใช้กติกาชุดเดียวกันทั้ง AI / ส่งเครื่อง / ออนไลน์ (`online/nn-engine.js` และ inline copy ใน `index.html` ต้องตรงกัน; ตรวจด้วย `tests/engine-parity.test.js`)
- พลังไพ่ Tarot 22 ใบเหมือนกันใน 2–4 คน · รองรับขั้นตอนเลือกค้าง (Sun / Chariot), Empress แทรกเทิร์น, Emperor seal, Star protection และ Moon live reveal
- โหมดเกม: **แพ้ 1 คน** (ที่เหลือชนะ) และ **คัดออก** (4→3→2 เหลือผู้ชนะ 1 คน; ตกรอบแล้วกองรีเซ็ตเป็น 0 และเมื่อเหลือ 2 คนใช้พลังไพ่แบบ 2 คน)
- เวลา: ตาละ 60 วินาที · หลุดการเชื่อมต่อรอได้ 120 วินาที · หมดเวลา/หลุดนาน/ออกจากเกม = ยอมแพ้ · Host หายเกิน 60 วินาที ย้ายให้คนอื่นอัตโนมัติ · ไม่มี AI แทนผู้เล่น
- ยังไม่มีเหรียญรางวัลในโหมดออนไลน์ (เหรียญของแอปเก็บใน localStorage แก้ได้จากเครื่อง จึงไม่ปลอดภัยพอ)

## 2) ติดตั้ง (ทำตามลำดับ)
**Supabase**
1. SQL Editor → รันไฟล์ใน `supabase/migrations/` **ตามลำดับ 001 → 002 → 003 → 004 → 005** (ทีละไฟล์ ต้องขึ้น Success) · `005_tarot_abilities.sql` เพิ่มคอลัมน์ `pending` แบบ private สำหรับตัวเลือก Sun และอัปเดต RPC commit action
2. Authentication → Sign In / Providers → เปิด **Allow anonymous sign-ins**
3. Edge Functions → สร้างฟังก์ชันชื่อ **`nn-api`** → วางทั้งไฟล์ `supabase/functions/nn-api/index.ts` → Deploy
   - ปิด "Verify JWT" ของฟังก์ชันนี้ (โค้ดตรวจ JWT ผู้เล่นเองแล้ว)
   - ไม่ต้องตั้ง secret: ระบบใส่ `SUPABASE_URL` และ service key ให้เอง (ห้ามนำไปใส่ GitHub) · ถ้าปิด legacy key แล้ว ให้เพิ่ม secret `SB_SECRET_KEY` · ถ้าเปิดจากโดเมนอื่นเพิ่ม `ALLOWED_ORIGINS`
**GitHub (repo `HRTA2026`, branch `main`)**
4. แตก ZIP แล้วอัปโหลดทับทุกไฟล์ (ต้องมีโฟลเดอร์ `img/`, `online/`, `supabase/`, `docs/`)
5. รอ Pages deploy แล้วเปิด `…/sw.js` ต้องเห็น `VERSION = "v31"` → ล้างแคช/เปิดแท็บใหม่
**ทุกครั้งที่อัปเดตโค้ด:** ถ้าแก้ไฟล์ใน `online/` ที่เกี่ยวกับเซิร์ฟเวอร์ (`nn-engine.js`, `nn-server.js`, `nn-api-core.js`) ให้รัน `node tools/build-edge.js` แล้ววาง `index.ts` ใหม่ใน Edge Function ด้วย ; เปลี่ยน `VERSION` ใน `sw.js` ทุกครั้งที่ deploy

## 3) ค่าที่ปรับได้
| อะไร | ที่ไหน |
|---|---|
| Project URL / publishable key | `online/config.js` (เปิดเผยได้) |
| ตัวคูณเหรียญเกมไพ่ / โบนัสอื่น | `window.COIN_X` ใน `index.html` (ตอนนี้ ×2 / ×1.5) · ราคาอาหาร+เครื่องแต่งกาย `PM` (1.25) |
| เวลาตา 60 วิ · รอ reconnect 120 วิ · ถือว่าออนไลน์ถ้ามี heartbeat ภายใน 45 วิ | `TURN_MS`, `RECONNECT_MS`, `HB_FRESH_MS` ใน `online/nn-api-core.js` (+ ค่า 45/60/30 วินาทีใน SQL 003 ถ้าอยากเปลี่ยน host/reconnect) |
| เวลานอนของน้องเบสท์ | `SLEEP` ใน `index.html` (60000 = 1 นาที) |

## 4) ต้นทุนและข้อจำกัดของ Free tier (ตรวจหน้าทางการก่อน deploy จริง)
ตัวเลขจากบทความสรุปราคาภายนอก (ไม่ใช่หน้าทางการ ณ ต้น พ.ย. 2026): DB 500 MB · Edge Function 500,000 ครั้ง/เดือน · Realtime 200 connection พร้อมกัน, 2 ล้านข้อความ/เดือน · egress 5 GB · **โปรเจกต์ถูก pause เมื่อไม่มีการใช้งาน 7 วัน** (ข้อมูลไม่หาย แต่เกมใช้ไม่ได้จนกด Restore)
ประมาณการของเรา (ไม่ได้วัดจริง): 1 ตา = 1 invocation, เกมละ 40–60 ตา → รองรับราว 10,000 เกม/เดือน ; Realtime ราว 4,000 เกม/เดือน ; 200 connection ≈ 50 โต๊ะพร้อมกัน — พอสำหรับทีม/กลุ่มเพื่อน
ต้องจ่ายเมื่อไร: อยากให้พร้อมเล่นตลอดโดยไม่ถูก pause (Pro) หรือผู้ใช้เกินเพดานข้างต้น · ผู้ใช้ทั้งทีมใช้ Wi-Fi เดียวกันอาจชนขีดจำกัดการ sign-in แบบ anonymous ต่อ IP (ดู Authentication → Rate Limits)

## 5) ความปลอดภัย
- หน้าเว็บมีแค่ publishable key ; `service_role` อยู่ใน Edge Function เท่านั้น
- ทุกตารางเปิด RLS ; client อ่านได้เฉพาะข้อมูลที่เป็นสมาชิก ; เขียนไม่ได้เลย ; มือคนอื่น/สำรับ/heartbeat อ่านไม่ได้ ; ฟังก์ชัน commit เรียกได้เฉพาะ service_role
- ตรวจด้วยมือ: `supabase/tests/rls_check.sql` (ทุกข้อต้องได้ผลตามคอมเมนต์)
- กันลงซ้ำ/ชนกัน: `request_id` + เลข version ; กันเดารหัสห้อง: จำกัด 10 ครั้ง/นาที ; ชื่อ ≤ 12 ตัว ตัดอักขระอันตราย

## 6) ทดสอบ
อัตโนมัติ (ในเครื่องผู้พัฒนา ใช้ฐานข้อมูลจำลอง): `node tests/engine-parity.test.js` · `node tests/api.test.js` · `node tests/elimination.test.js` · `node tests/edge-wrapper.test.js` · `python3 tests/e2e.test.py` (ต้อง `python3 -m http.server 8765` และ playwright)
ด้วยเครื่องจริง (ต้องทำ): สร้างห้อง 2/3/4 เครื่อง · ทั้งสองโหมดจนจบ + Rematch · ปล่อยหมดเวลา · ปิดแอปกลางเกมแล้วกลับมา · Host หลุด · ออกจากห้องกลางเกม · ลองอ่านข้อมูลคนอื่นด้วย `rls_check.sql` · Android Chrome / iPhone Safari / เดสก์ท็อป

## 7) แก้ปัญหาที่พบบ่อย
| อาการ | สาเหตุ/วิธีแก้ |
|---|---|
| หน้าเว็บยังเป็นของเก่า | อัปโหลดไฟล์ ZIP ทั้งก้อนแทนไฟล์ข้างใน / Pages ยัง deploy ไม่เสร็จ / แคช → ดู `…/sw.js` ว่าเป็น v31 แล้วล้างแคช |
| "โหลดตัวเชื่อมต่อออนไลน์ไม่สำเร็จ" | ไม่มีอินเทอร์เน็ต หรือโหลด jsDelivr ไม่ได้ (เวอร์ชัน supabase-js ล็อกไว้ใน `config.js`) |
| "ผู้ดูแลยังไม่ได้เปิด Anonymous sign-ins" | เปิดตามข้อ 2.2 |
| เริ่มเกมแล้วขึ้น server_error / ไม่ตอบ | ฟังก์ชันชื่อไม่ใช่ `nn-api` · ยังไม่ได้รัน SQL ครบ 001–005 หรือยังใช้ Edge Function รุ่นเก่า · วางโค้ดไม่ครบ · ดู Logs ของ Edge Function |
| CORS / 401 | เปิดจากโดเมนที่ไม่อยู่ใน `ALLOWED_ORIGINS` · ลืมปิด Verify JWT |
| เกมค้างไม่ขยับ | รอครบ 60 วิ แล้วระบบตัดสินหมดเวลาเอง (ต้องมีผู้เล่นอย่างน้อย 1 คนเปิดแอปอยู่) ; ถ้าทุกคนปิดแอป เกมค้างจนห้องหมดอายุ 6 ชม. |
| รูปไพ่ไม่ขึ้น | ตรวจว่าอัปโหลดโฟลเดอร์ `img/` ครบ 48 ไฟล์ และเปิดผ่านเว็บ (ไม่ใช่ดับเบิลคลิกไฟล์) |

## 8) โครงสร้างไฟล์
`index.html` (แอปเดิม + จุดส่งออก `__nn.ui`) · `sw.js` · `img/` · `online/` (`config.js`, `online.js` ห้อง/ล็อบบี้, `online-game.js` หน้าเกม, `nn-engine.js` / `nn-server.js` / `nn-api-core.js` ฝั่งเซิร์ฟเวอร์, `online.css`) · `supabase/migrations/001–005` · `supabase/functions/nn-api/index.ts` (สร้างด้วย `tools/build-edge.js`) · `supabase/tests/rls_check.sql` · `tests/` (มี Tarot rules / private-state tests) · `docs/` (`history/` = คู่มือแยกตาม Phase)

## 9) ข้อจำกัดที่ยังมี
- ล้างข้อมูลเบราว์เซอร์ = เสียที่นั่ง (Anonymous Auth) · ยังไม่มีเหรียญออนไลน์ · ยังไม่มีงานเบื้องหลังตัดสินเมื่อทุกคนปิดแอป
- **SQL migration 005 และ Edge Function v31 ยังไม่ได้ถูก deploy/ทดสอบกับ Supabase จริงในขั้นตอนจัดทำชุดไฟล์นี้** · ต้องรัน Migration 005 และ Deploy Edge Function ใหม่ก่อนเล่นออนไลน์ · ยังต้องทดสอบบน iPhone/Android จริง
