-- =====================================================================
-- HRTA Online Multiplayer - Phase 2: เล่นไพ่จริง (เซิร์ฟเวอร์เป็นผู้ตัดสิน)
-- รันต่อจาก 001_phase1_rooms.sql  (SQL Editor > New query > วาง > Run)
-- หลักการ: ตรรกะเกมรันใน Edge Function `nn-api`; ฐานข้อมูลทำหน้าที่เก็บสถานะ + commit แบบ atomic
--   public_state          = ข้อมูลสาธารณะ (ทุกคนในห้องอ่านได้)
--   player_private_states = มือของแต่ละคน (อ่านได้เฉพาะเจ้าของ)
--   game_secrets          = สำรับ/กองทิ้ง (client อ่านไม่ได้เลย ไม่มี policy)
-- =====================================================================

create table if not exists public.games (
  id               uuid primary key default gen_random_uuid(),
  room_id          uuid not null references public.rooms(id) on delete cascade,
  round_no         int  not null,
  status           text not null default 'playing' check (status in ('playing','finished')),
  version          int  not null default 0,          -- ใช้ตรวจการชนกัน (optimistic concurrency)
  public_state     jsonb not null,
  cur_p            smallint not null,
  loser_p          smallint,
  turn_deadline_at timestamptz,                      -- Phase 3 ใช้ตัดเวลาตา/ผู้เล่นหลุด
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  finished_at      timestamptz,
  unique (room_id, round_no)
);

create table if not exists public.game_secrets (
  game_id uuid primary key references public.games(id) on delete cascade,
  deck    jsonb not null,
  disc    jsonb not null
);

create table if not exists public.player_private_states (
  game_id    uuid not null references public.games(id) on delete cascade,
  user_id    uuid not null,
  seat       smallint not null,
  hand       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (game_id, user_id)
);

create table if not exists public.game_actions (
  id         bigint generated always as identity primary key,
  game_id    uuid not null references public.games(id) on delete cascade,
  seq        int  not null,
  user_id    uuid not null,
  request_id uuid not null,
  action_type text not null,
  payload    jsonb,
  created_at timestamptz not null default now(),
  unique (game_id, seq),
  unique (game_id, request_id)
);

create index if not exists games_room on public.games (room_id, round_no desc);

-- ---------- RLS ----------
alter table public.games                 enable row level security;
alter table public.game_secrets          enable row level security;
alter table public.player_private_states enable row level security;
alter table public.game_actions          enable row level security;

drop policy if exists games_select on public.games;
create policy games_select on public.games
  for select to authenticated
  using (public.nn_is_room_member(room_id));

drop policy if exists pps_select on public.player_private_states;
create policy pps_select on public.player_private_states
  for select to authenticated
  using (user_id = auth.uid());

-- game_secrets / game_actions: ไม่มี policy = client เข้าถึงไม่ได้เลย

revoke all on public.games, public.game_secrets, public.player_private_states, public.game_actions
  from anon, authenticated;
grant select on public.games, public.player_private_states to authenticated;

-- ---------- Phase 1 เดิม: เริ่มเกมต้องผ่าน Edge Function เท่านั้น (ต้องแจกไพ่) ----------
drop function if exists public.nn_start_game(uuid);

-- host ปิดห้อง (แก้ให้ปิดห้องที่จบเกมแล้วได้ด้วย)
create or replace function public.nn_close_room(p_room uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare r public.rooms%rowtype;
begin
  select * into r from public.rooms where id = p_room for update;
  if not found then raise exception 'room_not_found'; end if;
  if r.host_user_id <> auth.uid() then raise exception 'not_host'; end if;
  if r.status not in ('lobby','playing','finished') then raise exception 'room_closed'; end if;
  update public.rooms set status = 'closed', updated_at = now() where id = p_room;
end;
$$;

-- Rematch: host พาทุกคนกลับล็อบบี้ (ทุกคนต้องกด พร้อม ใหม่)
create or replace function public.nn_rematch(p_room uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare r public.rooms%rowtype;
begin
  select * into r from public.rooms where id = p_room for update;
  if not found then raise exception 'room_not_found'; end if;
  if r.host_user_id <> auth.uid() then raise exception 'not_host'; end if;
  if r.status <> 'finished' then raise exception 'room_not_finished'; end if;
  update public.room_players set is_ready = false where room_id = p_room and left_at is null;
  update public.rooms set status = 'lobby', updated_at = now(), expires_at = now() + interval '2 hours'
   where id = p_room;
end;
$$;

-- ---------- commit (เรียกได้เฉพาะ Edge Function ที่ใช้ service_role) ----------
-- เริ่มเกม: ตรวจเงื่อนไขซ้ำภายใน transaction เดียว (กันคนออก/เปลี่ยนสถานะระหว่างที่เซิร์ฟเวอร์แจกไพ่)
create or replace function public.nn_commit_start(
  p_room uuid, p_host uuid, p_public jsonb, p_secret jsonb, p_hands jsonb, p_cur int, p_deadline timestamptz)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  r public.rooms%rowtype;
  n int; not_ready int; matched int; keys int;
  gid uuid; rno int; k text; v jsonb;
begin
  select * into r from public.rooms where id = p_room for update;
  if not found then return jsonb_build_object('error','room_not_found'); end if;
  if r.host_user_id <> p_host then return jsonb_build_object('error','not_host'); end if;
  if r.status <> 'lobby' then return jsonb_build_object('error','room_started'); end if;
  if r.expires_at < now() then return jsonb_build_object('error','room_expired'); end if;
  if r.mode <> 'one_loser' then return jsonb_build_object('error','mode_not_ready'); end if;
  if (p_public->>'cap')::int <> r.cap then return jsonb_build_object('error','stale'); end if;

  select count(*), count(*) filter (where not is_ready)
    into n, not_ready
    from public.room_players where room_id = p_room and left_at is null;
  if n < 2 or n > 4 then return jsonb_build_object('error','bad_player_count'); end if;
  if not_ready > 0 then return jsonb_build_object('error','not_all_ready'); end if;

  select count(*) into keys from jsonb_object_keys(p_hands);
  select count(*) into matched from public.room_players rp
   where rp.room_id = p_room and rp.left_at is null and jsonb_exists(p_hands, rp.user_id::text);
  if keys <> n or matched <> n then return jsonb_build_object('error','stale'); end if;

  select coalesce(max(round_no),0) + 1 into rno from public.games where room_id = p_room;
  insert into public.games (room_id, round_no, public_state, cur_p, turn_deadline_at)
  values (p_room, rno, p_public, p_cur, p_deadline) returning id into gid;
  insert into public.game_secrets (game_id, deck, disc)
  values (gid, p_secret->'deck', p_secret->'disc');

  for k, v in select * from jsonb_each(p_hands) loop
    insert into public.player_private_states (game_id, user_id, seat, hand)
    select gid, rp.user_id, rp.seat, v
      from public.room_players rp
     where rp.room_id = p_room and rp.left_at is null and rp.user_id = k::uuid;
  end loop;

  update public.rooms set status = 'playing', updated_at = now(), expires_at = now() + interval '6 hours'
   where id = p_room;
  return jsonb_build_object('game_id', gid, 'round', rno);
end;
$$;

-- ลงไพ่: ตรวจ version (CAS) + กันส่งซ้ำด้วย request_id แล้วเขียนทุกอย่างพร้อมกัน
create or replace function public.nn_commit_action(
  p_game uuid, p_expected int, p_user uuid, p_request uuid,
  p_public jsonb, p_secret jsonb, p_hands jsonb, p_cur int, p_over int,
  p_deadline timestamptz, p_action jsonb)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  g public.games%rowtype;
  nv int; k text; v jsonb;
begin
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
  values (p_game, nv, p_user, p_request, 'play', p_action);

  if p_over >= 0 then
    update public.rooms set status = 'finished', updated_at = now() where id = g.room_id;
  end if;
  return jsonb_build_object('ok', true, 'version', nv);
end;
$$;

-- ---------- สิทธิ์ ----------
revoke all on function public.nn_rematch(uuid) from public, anon;
grant execute on function public.nn_rematch(uuid) to authenticated;
revoke all on function public.nn_close_room(uuid) from public, anon;
grant execute on function public.nn_close_room(uuid) to authenticated;

revoke all on function public.nn_commit_start(uuid,uuid,jsonb,jsonb,jsonb,int,timestamptz) from public, anon, authenticated;
revoke all on function public.nn_commit_action(uuid,int,uuid,uuid,jsonb,jsonb,jsonb,int,int,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.nn_commit_start(uuid,uuid,jsonb,jsonb,jsonb,int,timestamptz) to service_role;
grant execute on function public.nn_commit_action(uuid,int,uuid,uuid,jsonb,jsonb,jsonb,int,int,timestamptz,jsonb) to service_role;

-- Edge Function (service_role) ต้องอ่านตารางเหล่านี้ได้
grant select on public.games, public.game_secrets, public.player_private_states, public.game_actions,
                public.rooms, public.room_players to service_role;

-- ---------- Realtime ----------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'games') then
    alter publication supabase_realtime add table public.games;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'player_private_states') then
    alter publication supabase_realtime add table public.player_private_states;
  end if;
end $$;
