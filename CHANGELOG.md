# Changelog
## v34 — Online target-choice & Chariot UI fixes (2026-11-04)
- Bound Fool / Emperor / Moon target buttons and Empress interrupt to the exact selected card ID; target submissions no longer depend on the volatile selection state `M.sel`.
- Added explicit target prompt labels for hand swap, Emperor seal, and Moon reveal.
- In a two-player state, Fool / Emperor / Moon now show the sole opponent as an explicit automatic target instead of a generic `+0` / `+4` play button.
- Chariot's skip action remains visible throughout its pending phase; it is disabled during animation/submission rather than disappearing. The second-card play options now carry their own card ID.
- Added API regression coverage for 3-player target mapping, 2-player automatic targeting, and Chariot skip flow, plus UI contract tests and focused Playwright scenarios.
- Service worker cache version bumped to `v34`. No schema or migration change; Edge Function logic is unchanged.

## v33 — Online Star choice & landscape polish (2026-11-04)
- Hardened the Star ±17 UI action: each choice carries the exact selected card ID, and a failed request restores the card selection so the player can retry.
- Added API regression tests for both Star values through the authoritative online server/engine path.
- Added regression coverage for same-turn deadline preservation across Chariot and Empress follow-up actions.
- Emperor-sealed cards now show only a printed-value play action online; special prompts such as Star ±17 are suppressed while sealed.
- Added the full-screen / landscape control to two-player online tables and responsive sizing for short landscape screens.
- Preserved the current 60-second deadline through sub-actions and off-turn Empress interrupts; a new active player's turn gets a fresh deadline.
- Updated the E2E mock to support private `{hand,pending}` state, Star choices, and pending bot actions. Browser E2E remains to be run on a local machine because this build environment blocks localhost navigation.

## v32 — Online Star & landscape fixes (2026-11-04)
- Hardened online Star choice submission by carrying the exact selected card ID in the ±17 action buttons; failed validation keeps the card selected for retry.
- Added authoritative API regression cases for both Star values.
- Fixed Emperor-sealed cards in online UI: all sealed cards now expose only their printed face value (including Star), with no target/effect choice.
- Added full-screen / landscape toggle for 2-player games as well as 3–4 player games.
- Added responsive landscape sizing for the online table.
- Kept the same 60-second deadline through multi-action turns and off-turn Empress interrupts; a new player's turn receives a fresh deadline.
- Updated E2E Supabase mock to store `{hand,pending}` private payloads and handle bot Star/target/Sun/Chariot actions.

## v31 — Phase 5: Tarot powers + Stateful Turn Engine
- ปรับพลังไพ่ 22 ใบเป็นชุดเดียวกันทุกโหมด/ทุกจำนวนผู้เล่น 2–4 คน: Fool สลับมือหลังจั่ว, Magician เสก Devil, Priestess สลับหลักสิบ/หน่วยแล้ว +2, Empress แทรกเทิร์น, Emperor ผนึกพลัง, Chariot ลงเพิ่ม/ข้าม, Star ±17 และป้องกัน Heat 2 ตาตัวเอง, Moon เปิดมือ, Sun เลือก 1 จาก 3, World เท่ากับเพดานและไม่รับ Heat
- Shared Engine v3: เพิ่ม pending phases สำหรับ Sun/Chariot, Devil ลงสองใบรวด, Empress off-turn + draw-only next normal turn, Emperor seal, Star protection, Moon live reveal, Fool post-draw swap; เพิ่ม AI decisions และ authoritative server actions `interrupt` / `choose` / `skip`
- Online: เพิ่ม private `pending` ให้ `player_private_states` (ตัวเลือก Sun ไม่ส่งใน public state), เปิด `revealedHand` เฉพาะ Moon, ทุก action ต่อเนื่องรีเฟรช deadline 60 วินาที; เพิ่ม SQL `005_tarot_abilities.sql`
- Offline/ออนไลน์ใช้กติกาเดียวกัน; ซิงก์ inline engine ใน `index.html` จาก `online/nn-engine.js`; ปรับ prompt UI, ตัวเลือกเป้าหมาย/Star/Sun/Chariot/Empress และคำบรรยายพลัง
- เพิ่ม/ปรับ automated tests: 900 elimination simulations, 75 complete API games, targeted tests สำหรับ Priestess, Heat/Star/World, Emperor, Chariot/Devil, Sun privacy, Empress interrupt, Moon live reveal และ card conservation ระหว่าง Sun forfeit
- Service worker `v31`; ต้องรัน SQL 005 หลัง 001–004 และ Build/Deploy Edge Function ใหม่
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
