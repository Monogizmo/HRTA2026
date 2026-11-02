# Changelog
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
