# Changelog
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
