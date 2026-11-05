# Changelog
## v32 — ปรับพลัง Moon / Sun + ภาพไพ่คมขึ้น
- **Moon**: +เลขหลักหน่วยของกองก่อนลง (กอง 109 → +9) แล้วเลือกทิ้งไพ่ในมือกี่ใบก็ได้ จั่วใหม่เท่าจำนวนที่ทิ้ง (ทำหลังจั่วคืนปกติ) — ไม่ต้องเลือกเป้าหมาย/ไม่หงายไพ่แล้ว
- **Sun**: เพิ่มเพดานของเกม +19 (สะสมไม่จำกัด) → +19 → Heat ถาวร +1 ตลอดเกม · ใบที่ลงไม่โดนไฟ จึงไม่มีทางแพ้ · ยกเลิก "เปิด 3 เลือก 1"
- engine: `G.hb` (Heat ถาวร), `G.swap`, pend `moon`; ออนไลน์: action `swap` (ix = ดัชนีไพ่ที่ทิ้ง) แทน `pick`, `pub.hb`, `pub.cap` เปลี่ยนระหว่างเกมได้ — **ต้อง deploy Edge Function `nn-api` ใหม่** (ไม่มี migration ใหม่)
- ภาพไพ่เลขเพดาน: ย่อเป็น 400px คุณภาพ 92% (เดิม 170px / 80%)
- เทสต์: อัปเดตให้ตรงพลังใหม่ (Moon/Sun/swap) · `sw.js` v32
## v31 — พลังไพ่ชุดใหม่ (engine + ออฟไลน์ + ออนไลน์)
- engine ใหม่: Fool สลับมือกับคนที่เลือก · Priestess สลับหลัก +2 · Empress แทรกเทิร์น · Emperor ผนึกไพ่ใบถัดไปของเป้าหมาย · Chariot ลงเพิ่ม 1 ใบ · Temperance ย้อนทิศ+ปัดขึ้น · Devil ไม่จั่วคั่น · Star ±17 + ดับไฟลามทุ่ง 2 ตา · Moon หงายไพ่คนที่เลือก · Sun เปิด 3 เลือก 1 · World = เพดาน ไฟไม่มีผล (ดู `docs/CARD_POWERS.md`)
- ออฟไลน์: เลือกเป้าหมาย / เลือกไพ่ Sun / ข้าม Chariot / แทรก Empress (โหมดเล่นกับ AI) / แสดงไพ่ที่ถูกหงาย / ไอคอนสถานะ 🛡️🔒⏳💧 · AI เล่นพลังใหม่ได้ · ข้อความพลังไพ่และบทพูด AI อัปเดต
- ออนไลน์: action ใหม่ `pass` `pick` `interject` + `tg`/`k` ใน `play` · `supabase/migrations/005_new_card_powers.sql` (คอลัมน์ `pend`, `extra`) · ไพ่ที่ Moon หงายอยู่ในข้อมูลสาธารณะ · ไพ่ 3 ใบของ Sun เห็นเฉพาะผู้เลือก
- เทสต์ใหม่: `engine-cards` (ทีละใบ + จำลอง AI 1,350 เกม), `engine-parity` เขียนใหม่ (เซิร์ฟเวอร์ = engine ทุก action 1,080 เกม), `offline-e2e`
- `sw.js` v31
## v30 — Phase 4: โหมดคัดออก + ตัดข้อความกติกา + เวลานอน
- โหมดออนไลน์ **คัดออก** (4→3→2 เหลือผู้ชนะ 1 คน; กองรีเซ็ตเมื่อตกรอบ; เหลือ 2 คนใช้พลังไพ่แบบ 2 คน; หมดเวลา/ออก = ตกรอบ) — `nn-server.js` ใช้ดัชนีผู้เล่นเดิมคงที่ + `alive/out/winner`, `supabase/migrations/004_phase4_elimination.sql`, หน้าจอที่นั่งคนตกรอบ/อันดับ
- ตัดข้อความอธิบายกติกาให้กระชับทุกเกม (เลขเพดาน พลังไพ่ สงครามไพ่ เลี้ยงน้องเบสท์ เกมวิ่ง จับคู่ไพ่) · เอา "(99 ปรับเพดานได้)" ออก · ลบคำอธิบายเรื่องชื่อ/พี่/AI และหัวข้อ "ทำไมปรับสมดุล" ของสงครามไพ่
- น้องเบสท์นอนหลับ 1 นาที (เดิม 3 นาที)
- เอกสารรวม `docs/README.md` (คู่มือ Phase เดิมย้ายไป `docs/history/`) · เพิ่ม `tests/elimination.test.js` และ e2e ทั้งสองโหมด
## v29 — Phase 3 + หน้าตาออนไลน์เหมือนออฟไลน์ + ปรับเศรษฐกิจเหรียญ
- หน้าเกมออนไลน์ใช้โต๊ะ/ไพ่/เอฟเฟกต์/เสียงชุดเดียวกับโหมดออฟไลน์ (index.html ส่งออก `window.__nn.ui`; `desc()` รับ two/cap ได้); ย่อรูปไพ่ล่วงหน้า + fallback รูปเต็ม
- Phase 3: heartbeat, ตาละ 60 วิ, รอ reconnect 120 วิ, หมดเวลา/หลุด/ออก = ยอมแพ้, ย้าย Host อัตโนมัติ, เชื่อม Realtime ใหม่อัตโนมัติ
- ใหม่: `supabase/migrations/003_phase3_stability.sql`, `supabase/tests/rls_check.sql`, action `check`/`forfeit` ใน `nn-api`
- เศรษฐกิจเหรียญ (แอปเดิม): ราคาอาหาร+เครื่องแต่งกายลดครึ่ง (PM 2.5→1.25; ยา 50 เท่าเดิม) · เหรียญจากเกมไพ่ (จับคู่ไพ่/สงครามไพ่/เลขเพดาน) ×2 · โบนัสอื่นทั้งเว็บ (รายวัน/BINGO/Quiz ฯลฯ) ×1.5 · เกมวิ่งไม่เปลี่ยน — ปรับได้ที่ `window.COIN_X` ใน index.html
- `sw.js` v29
## v28 — Phase 2: เล่นไพ่จริงแบบเซิร์ฟเวอร์เป็นผู้ตัดสิน
- ใหม่: `online/nn-engine.js` (engine คัดลอกตรงจาก index.html), `nn-server.js`, `nn-api-core.js`, `online-game.js`
- ใหม่: `supabase/migrations/002_phase2_gameplay.sql`, `supabase/functions/nn-api/index.ts` (สร้างด้วย tools/build-edge.js)
- แก้: `online/online.js` (หน้าจอเกม/Realtime ของเกม/เรียก Edge Function), `online.css`, `index.html` (เพิ่ม script), `sw.js` (v28)
- เริ่มเกมต้องผ่าน Edge Function (ลบ `nn_start_game` เดิมของ Phase 1); โหมด "คัดออก" ยังปิด
- เพิ่ม tests/ (parity, api, edge-wrapper, e2e)
## v27 — Phase 1: ห้อง + ล็อบบี้ออนไลน์
- เพิ่ม `online/` (config.js, online.js, online.css) และ `supabase/migrations/001_phase1_rooms.sql`
- `index.html`: เพิ่ม link/script ของ online (ไม่แก้ engine, AI, โหมดเพื่อนเดิม)
- `sw.js`: v27, เพิ่มไฟล์ online ใน cache, เพิ่ม cdn.jsdelivr.net ใน KEEP_HOSTS
## v26 — แยกรูป base64 48 รูปออกจาก index.html ไปไว้ใน img/ (10.7 MB → ~0.5 MB)
