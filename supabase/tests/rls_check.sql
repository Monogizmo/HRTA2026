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
