-- =====================================================================
-- ตรวจความปลอดภัย (RLS / anti-cheat) ด้วยมือ — รันใน SQL Editor หลังมีเกมที่เริ่มแล้วอย่างน้อย 1 เกม
-- วิธีใช้: แก้ <USER_A> เป็น UUID ผู้เล่นคนหนึ่ง (ดูได้จาก select user_id from room_players)
--          แล้วรันทีละบล็อก (แต่ละบล็อกเป็น transaction แล้ว rollback ไม่แก้ข้อมูล)
-- ผลที่ถูกต้องอยู่ในคอมเมนต์ท้ายแต่ละคำสั่ง
-- =====================================================================

begin;
  select set_config('request.jwt.claims', '{"sub":"<USER_A>","role":"authenticated"}', true);
  set local role authenticated;

  -- 1) มือของคนอื่นต้องอ่านไม่ได้
  select count(*) as other_hands_visible from public.player_private_states where user_id <> '<USER_A>'::uuid;   -- ต้องเป็น 0
  -- 2) มือของตัวเองอ่านได้
  select count(*) as my_hands from public.player_private_states where user_id = '<USER_A>'::uuid;               -- >= 1
  -- 3) สำรับ/กองทิ้ง ต้องอ่านไม่ได้เลย
  select * from public.game_secrets;                                  -- ต้อง error: permission denied
rollback;

begin;
  select set_config('request.jwt.claims', '{"sub":"<USER_A>","role":"authenticated"}', true);
  set local role authenticated;
  select * from public.game_actions;                                  -- ต้อง error: permission denied
rollback;

begin;
  select set_config('request.jwt.claims', '{"sub":"<USER_A>","role":"authenticated"}', true);
  set local role authenticated;
  select * from public.player_heartbeats;                             -- ต้อง error: permission denied
rollback;

-- 4) client เขียนตารางตรง ๆ ไม่ได้ (ต้องผ่านฟังก์ชัน/Edge Function เท่านั้น)
begin;
  select set_config('request.jwt.claims', '{"sub":"<USER_A>","role":"authenticated"}', true);
  set local role authenticated;
  update public.games set public_state = '{}'::jsonb;                 -- ต้อง error: permission denied
rollback;
begin;
  select set_config('request.jwt.claims', '{"sub":"<USER_A>","role":"authenticated"}', true);
  set local role authenticated;
  update public.player_private_states set hand = '[]'::jsonb;         -- ต้อง error: permission denied
rollback;

-- 5) client เรียกฟังก์ชัน commit ของเซิร์ฟเวอร์เองไม่ได้
begin;
  select set_config('request.jwt.claims', '{"sub":"<USER_A>","role":"authenticated"}', true);
  set local role authenticated;
  select public.nn_commit_action(gen_random_uuid(), 0, gen_random_uuid(), gen_random_uuid(),
         '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 0, -1, now(), '{}'::jsonb, 'play');   -- ต้อง error: permission denied for function
rollback;

-- 6) ไม่ล็อกอิน (anon) อ่านอะไรไม่ได้
begin;
  set local role anon;
  select count(*) from public.games;                                  -- ต้อง error: permission denied
rollback;

-- =====================================================================
-- เพิ่มใน 006 (สงครามไพ่ยุทธวิธีออนไลน์) — รันหลังมีห้อง war อย่างน้อย 1 ห้อง และมีเกม war ที่กำลังเล่น 1 เกม
-- ตารางใหม่ไม่มี (ใช้ตารางเดิมที่เปิด RLS แล้ว) จึงตรวจ: คอลัมน์ใหม่ ฟังก์ชันใหม่ และความลับของการเลือกที่ยังไม่เปิด
-- =====================================================================

-- 7) client เรียกฟังก์ชัน commit/start ของสงครามไพ่เองไม่ได้ (service_role เท่านั้น)
begin;
  select set_config('request.jwt.claims', '{"sub":"<USER_A>","role":"authenticated"}', true);
  set local role authenticated;
  select public.war_commit(gen_random_uuid(), 0, gen_random_uuid(), gen_random_uuid(),
         '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, -1, now(), 'resolve');                        -- ต้อง error: permission denied for function
rollback;
begin;
  select set_config('request.jwt.claims', '{"sub":"<USER_A>","role":"authenticated"}', true);
  set local role authenticated;
  select public.war_commit_start(gen_random_uuid(), gen_random_uuid(), '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, now());  -- ต้อง error: permission denied for function
rollback;

-- 8) การเลือกที่ยังไม่เปิด (game_secrets.pend) อ่านไม่ได้เด็ดขาด — ทั้งของตัวเองและของอีกฝั่ง
begin;
  select set_config('request.jwt.claims', '{"sub":"<USER_A>","role":"authenticated"}', true);
  set local role authenticated;
  select pend from public.game_secrets;                                                      -- ต้อง error: permission denied
rollback;

-- 9) public_state ของเกม war ต้องไม่มีมือ/กองจั่ว/ไพ่ที่เลือกแต่ยังไม่เปิด (รันด้วยบทบาท postgres/service เพื่อตรวจเนื้อหา)
select g.id,
       g.public_state ?| array['hand','hands','deck','pend','disc_cards'] as leaks      -- ต้องเป็น false ทุกแถว
  from public.games g join public.rooms r on r.id = g.room_id
 where r.game_type = 'war';

-- 10) ผู้เล่นอ่านมือของอีกฝั่งในเกม war ไม่ได้ (นโยบายเดิมของ player_private_states ครอบคลุมแล้ว — ตรวจซ้ำ)
begin;
  select set_config('request.jwt.claims', '{"sub":"<USER_A>","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) as other_hands_visible
    from public.player_private_states p join public.games g on g.id = p.game_id join public.rooms r on r.id = g.room_id
   where r.game_type = 'war' and p.user_id <> '<USER_A>'::uuid;                              -- ต้องเป็น 0
rollback;

-- 11) anon เรียกฟังก์ชันสร้าง/ตั้งค่าห้อง war ไม่ได้
begin;
  set local role anon;
  select public.war_create_room('x', '', '{"clash":"u","fool":1}'::jsonb);                    -- ต้อง error: permission denied for function
rollback;

-- 12) ตั้งค่าห้อง war ได้เฉพาะ Host และห้อง nn ใช้ war_update_settings ไม่ได้ (ต้อง error: not_host / wrong_game_type)
begin;
  select set_config('request.jwt.claims', '{"sub":"<USER_B_NOT_HOST>","role":"authenticated"}', true);
  set local role authenticated;
  select public.war_update_settings('<WAR_ROOM_ID>'::uuid, '{"clash":"eq","fool":0}'::jsonb);  -- ต้อง error: not_host
rollback;

-- =====================================================================
-- เพิ่มใน 007 (Quiz Leaderboard)
-- =====================================================================
-- 13) client อ่าน/เขียนตารางคะแนนตรงไม่ได้ (ต้อง error: permission denied for table quiz_scores / quiz_log)
begin;
  select set_config('request.jwt.claims', '{"sub":"<USER_A>","role":"authenticated"}', true);
  set local role authenticated;
  select * from public.quiz_scores;
rollback;
begin;
  select set_config('request.jwt.claims', '{"sub":"<USER_A>","role":"authenticated"}', true);
  set local role authenticated;
  insert into public.quiz_scores (player_name, best, last_score, plays, total) values ('hack', 20, 20, 1, 20);
rollback;
-- 14) anon เรียกฟังก์ชันไม่ได้ ; authenticated เรียกได้ และคะแนนนอกช่วง 0–20 ถูกปฏิเสธ
begin;
  set local role anon;
  select public.quiz_leaderboard();                                  -- ต้อง error: permission denied for function
rollback;
begin;
  select set_config('request.jwt.claims', '{"sub":"<USER_A>","role":"authenticated"}', true);
  set local role authenticated;
  select public.quiz_submit('ทดสอบ', 21);                            -- ต้อง error: bad_score
rollback;
begin;
  select set_config('request.jwt.claims', '{"sub":"<USER_A>","role":"authenticated"}', true);
  set local role authenticated;
  select public.quiz_submit('ทดสอบ', 15);                            -- ok: {name,best,plays}
  select public.quiz_submit('ทดสอบ', 9);                             -- plays = 2, best ยังเป็น 15
  select public.quiz_leaderboard();
rollback;
