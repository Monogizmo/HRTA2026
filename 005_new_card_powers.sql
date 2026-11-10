-- =====================================================================
-- HRTA Online Multiplayer - พลังไพ่ชุดใหม่ (Emperor/Chariot/Moon/Sun/Empress/Star ฯลฯ)
-- รันต่อจาก 001–004  (SQL Editor > New query > วาง > Run)
-- เพิ่ม: game_secrets.pend (ไพ่ 3 ใบของ The Sun ที่รอเลือก — ลับ), player_private_states.extra (ไพ่ที่รอเลือกของผู้เล่นคนนั้น — ส่วนตัว)
--        และให้ nn_commit_action เขียน extra ได้ (เรียกได้เฉพาะ service_role เหมือนเดิม)
-- =====================================================================
alter table public.game_secrets          add column if not exists pend  jsonb;
alter table public.player_private_states add column if not exists extra jsonb;

drop function if exists public.nn_commit_action(uuid,int,uuid,uuid,jsonb,jsonb,jsonb,int,int,timestamptz,jsonb,text);

create or replace function public.nn_commit_action(
  p_game uuid, p_expected int, p_user uuid, p_request uuid,
  p_public jsonb, p_secret jsonb, p_hands jsonb, p_cur int, p_over int,
  p_deadline timestamptz, p_action jsonb, p_type text default 'play', p_extras jsonb default '{}'::jsonb)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  g public.games%rowtype;
  nv int; k text; v jsonb;
begin
  if p_type not in ('play','forfeit') then return jsonb_build_object('error','bad_type'); end if;
  select * into g from public.games where id = p_game for update;
  if not found then return jsonb_build_object('error','game_not_found'); end if;

  if exists (select 1 from public.game_actions where game_id = p_game and request_id = p_request) then
    return jsonb_build_object('ok', true, 'dup', true, 'version', g.version);
  end if;
  if g.status <> 'playing' then return jsonb_build_object('error','game_over'); end if;
  if g.version <> p_expected then return jsonb_build_object('error','stale','version', g.version); end if;

  nv := g.version + 1;
  update public.games
     set version = nv, public_state = p_public, cur_p = p_cur,
         loser_p = case when p_over >= 0 then p_over else null end,
         status = case when p_over >= 0 then 'finished' else 'playing' end,
         turn_deadline_at = case when p_over >= 0 then null else p_deadline end,
         finished_at = case when p_over >= 0 then now() else null end,
         updated_at = now()
   where id = p_game;

  update public.game_secrets
     set deck = p_secret->'deck', disc = p_secret->'disc',
         pend = case when jsonb_typeof(p_secret->'pend') = 'array' then p_secret->'pend' else null end
   where game_id = p_game;

  for k, v in select * from jsonb_each(p_hands) loop
    update public.player_private_states set hand = v, updated_at = now()
     where game_id = p_game and user_id = k::uuid;
  end loop;

  -- ข้อมูลส่วนตัวที่รอเลือก (ไพ่ของ The Sun) ; ค่า null = ล้าง
  for k, v in select * from jsonb_each(coalesce(p_extras, '{}'::jsonb)) loop
    update public.player_private_states
       set extra = case when jsonb_typeof(v) = 'null' then null else v end, updated_at = now()
     where game_id = p_game and user_id = k::uuid;
  end loop;

  insert into public.game_actions (game_id, seq, user_id, request_id, action_type, payload)
  values (p_game, nv, p_user, p_request, p_type, p_action);

  if p_over >= 0 then
    update public.rooms set status = 'finished', updated_at = now() where id = g.room_id;
  end if;
  return jsonb_build_object('ok', true, 'version', nv);
end;
$$;

revoke all on function public.nn_commit_action(uuid,int,uuid,uuid,jsonb,jsonb,jsonb,int,int,timestamptz,jsonb,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.nn_commit_action(uuid,int,uuid,uuid,jsonb,jsonb,jsonb,int,int,timestamptz,jsonb,text,jsonb)
  to service_role;
-- (สิทธิ์ select ของ client บน player_private_states ยังเป็นเฉพาะแถวของตัวเอง ตาม policy เดิม ดังนั้น extra ของผู้อื่นอ่านไม่ได้)
