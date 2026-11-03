-- =====================================================================
-- HRTA Online Multiplayer - Phase 3: เสถียรภาพ (reconnect / timeout / ย้าย Host)
-- รันต่อจาก 001 และ 002  (SQL Editor > New query > วาง > Run)
--
-- นโยบายเวลา (ตามที่ตกลง):
--   * ตาละ 60 วินาที (turn_deadline_at)         * ผู้เล่นหลุดให้เวลากลับ 120 วินาที นับจากครั้งสุดท้ายที่เห็น
--   * หมดเวลา = ผู้เล่นนั้นยอมแพ้ (เกมจบ) — ไม่มี AI แทน ไม่ข้ามตา
--   * กลับมาตอนเป็นตาของตัวเอง = ได้เวลาเพิ่มอย่างน้อย 30 วินาที
--   * Host หายเกิน 60 วินาที = โอน Host ให้สมาชิกที่ออนไลน์และเข้าห้องก่อนคนอื่น
-- การตัดสินหมดเวลา/ยอมแพ้ทำที่ Edge Function (action check/forfeit) ; SQL ส่วนนี้เก็บ heartbeat + ย้าย Host
-- =====================================================================

-- ---------- heartbeat (ไม่อยู่ใน Realtime จึงไม่ทำให้เกิดข้อความกระจายถึงทุกคน) ----------
create table if not exists public.player_heartbeats (
  room_id      uuid not null references public.rooms(id) on delete cascade,
  user_id      uuid not null,
  last_seen_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
alter table public.player_heartbeats enable row level security;     -- ไม่มี policy = client อ่าน/เขียนตรง ๆ ไม่ได้
revoke all on public.player_heartbeats from anon, authenticated;
grant select on public.player_heartbeats to service_role;

-- client เรียกทุก ~20 วินาทีขณะอยู่ในห้อง ; คืนเวลาเซิร์ฟเวอร์เพื่อให้นาฬิกานับถอยหลังตรงกันทุกเครื่อง
create or replace function public.nn_heartbeat(p_room uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  me public.room_players%rowtype;
  was_stale boolean := false;
  my_p int;
  r public.rooms%rowtype;
  host_seen timestamptz;
  cand uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into me from public.room_players
   where room_id = p_room and user_id = uid and left_at is null;
  if not found then raise exception 'not_in_room'; end if;

  select (last_seen_at < now() - interval '45 seconds') into was_stale
    from public.player_heartbeats where room_id = p_room and user_id = uid;
  was_stale := coalesce(was_stale, false);

  insert into public.player_heartbeats (room_id, user_id, last_seen_at)
  values (p_room, uid, now())
  on conflict (room_id, user_id) do update set last_seen_at = now();

  -- กลับมาหลังหลุด: ถ้าเป็นตาของเรา ให้เวลาเล่นอย่างน้อย 30 วินาที
  if was_stale then
    select (e->>'p')::int into my_p
      from public.games g, jsonb_array_elements(g.public_state->'players') e
     where g.room_id = p_room and g.status = 'playing' and (e->>'seat')::int = me.seat
     order by g.round_no desc limit 1;
    if my_p is not null then
      update public.games
         set turn_deadline_at = greatest(coalesce(turn_deadline_at, now()), now() + interval '30 seconds')
       where room_id = p_room and status = 'playing' and cur_p = my_p;
    end if;
  end if;

  -- ย้าย Host อัตโนมัติ: Host หายเกิน 60 วินาที และเราเป็นสมาชิกที่ออนไลน์ + เข้าห้องก่อนคนอื่น
  select * into r from public.rooms where id = p_room for update;
  if r.status in ('lobby','playing','finished') and r.host_user_id <> uid then
    select coalesce(hb.last_seen_at, rp.joined_at) into host_seen
      from public.room_players rp
      left join public.player_heartbeats hb on hb.room_id = rp.room_id and hb.user_id = rp.user_id
     where rp.room_id = p_room and rp.user_id = r.host_user_id and rp.left_at is null;
    if host_seen is null or host_seen < now() - interval '60 seconds' then
      select rp.user_id into cand
        from public.room_players rp
        join public.player_heartbeats hb on hb.room_id = rp.room_id and hb.user_id = rp.user_id
       where rp.room_id = p_room and rp.left_at is null and hb.last_seen_at > now() - interval '45 seconds'
       order by rp.joined_at, rp.seat limit 1;
      if cand = uid then
        update public.rooms set host_user_id = uid, updated_at = now() where id = p_room;
        update public.room_players set is_host = (user_id = uid) where room_id = p_room and left_at is null;
      end if;
    end if;
  end if;

  return jsonb_build_object('now_ms', (extract(epoch from clock_timestamp()) * 1000)::bigint);
end;
$$;

revoke all on function public.nn_heartbeat(uuid) from public, anon;
grant execute on function public.nn_heartbeat(uuid) to authenticated;

-- ---------- nn_commit_action: เพิ่มชนิด action (play / forfeit) ----------
drop function if exists public.nn_commit_action(uuid,int,uuid,uuid,jsonb,jsonb,jsonb,int,int,timestamptz,jsonb);

create or replace function public.nn_commit_action(
  p_game uuid, p_expected int, p_user uuid, p_request uuid,
  p_public jsonb, p_secret jsonb, p_hands jsonb, p_cur int, p_over int,
  p_deadline timestamptz, p_action jsonb, p_type text default 'play')
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

  update public.game_secrets set deck = p_secret->'deck', disc = p_secret->'disc' where game_id = p_game;

  for k, v in select * from jsonb_each(p_hands) loop
    update public.player_private_states set hand = v, updated_at = now()
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

revoke all on function public.nn_commit_action(uuid,int,uuid,uuid,jsonb,jsonb,jsonb,int,int,timestamptz,jsonb,text)
  from public, anon, authenticated;
grant execute on function public.nn_commit_action(uuid,int,uuid,uuid,jsonb,jsonb,jsonb,int,int,timestamptz,jsonb,text)
  to service_role;
