-- =====================================================================
-- HRTA Online Multiplayer - Phase 1: ห้อง + ล็อบบี้
-- วิธีใช้: Supabase Dashboard > SQL Editor > New query > วางทั้งไฟล์ > Run
-- รันซ้ำได้ (idempotent) เว้นแต่จะอยากล้างข้อมูลเอง
-- หลักการ: client อ่านได้อย่างเดียว (RLS) ส่วนการเขียนทั้งหมดผ่านฟังก์ชันด้านล่างเท่านั้น
-- =====================================================================

-- ---------- ตาราง ----------
create table if not exists public.rooms (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  host_user_id  uuid not null,
  status        text not null default 'lobby'
                  check (status in ('lobby','playing','finished','closed','expired')),
  max_players   smallint not null default 4 check (max_players between 2 and 4),
  cap           smallint not null default 150 check (cap in (120,150,200)),
  mode          text not null default 'one_loser'
                  check (mode in ('one_loser','elimination')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '2 hours'
);

create table if not exists public.room_players (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms(id) on delete cascade,
  user_id      uuid not null,
  seat         smallint not null check (seat between 1 and 4),
  player_name  text not null,
  avatar       text not null default '',
  is_host      boolean not null default false,
  is_ready     boolean not null default false,
  joined_at    timestamptz not null default now(),
  left_at      timestamptz
);

-- 1 คน/1 ที่นั่ง ต่อห้อง (นับเฉพาะคนที่ยังไม่ออก) ; ออกแล้วกลับเข้ามาใหม่ได้เป็นแถวใหม่
create unique index if not exists room_players_active_user
  on public.room_players (room_id, user_id) where left_at is null;
create unique index if not exists room_players_active_seat
  on public.room_players (room_id, seat) where left_at is null;
create index if not exists room_players_user_active
  on public.room_players (user_id) where left_at is null;
create index if not exists rooms_status_expires on public.rooms (status, expires_at);

-- ตารางจำกัดอัตราการลองรหัสห้อง (กันเดารหัส)
create table if not exists public.join_attempts (
  user_id uuid not null,
  at      timestamptz not null default now()
);
create index if not exists join_attempts_user_at on public.join_attempts (user_id, at);

-- ---------- ตัวช่วย ----------
-- ตรวจว่า user เป็นสมาชิกห้อง (ใช้ใน RLS; SECURITY DEFINER เพื่อเลี่ยง recursion)
create or replace function public.nn_is_room_member(p_room uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_players
    where room_id = p_room and user_id = auth.uid() and left_at is null
  );
$$;

-- ทำความสะอาดชื่อ: ตัด <>&"'` และอักขระควบคุม ย่อช่องว่าง จำกัด 12 ตัวอักษร
create or replace function public.nn_clean_name(p text)
returns text
language sql immutable
as $$
  select left(
    btrim(regexp_replace(regexp_replace(coalesce(p,''), '[<>&"''`[:cntrl:]]', '', 'g'), '\s+', ' ', 'g')),
    12);
$$;

-- ---------- RLS ----------
alter table public.rooms         enable row level security;
alter table public.room_players  enable row level security;
alter table public.join_attempts enable row level security;

drop policy if exists rooms_select on public.rooms;
create policy rooms_select on public.rooms
  for select to authenticated
  using (public.nn_is_room_member(id));

drop policy if exists room_players_select on public.room_players;
create policy room_players_select on public.room_players
  for select to authenticated
  using (public.nn_is_room_member(room_id));

-- join_attempts: ไม่มี policy = client เข้าถึงไม่ได้เลย

-- ถอนสิทธิ์เขียนทั้งหมดจาก client
revoke all on public.rooms, public.room_players, public.join_attempts from anon, authenticated;
grant select on public.rooms, public.room_players to authenticated;

-- ---------- ฟังก์ชันห้อง ----------
-- รหัสห้อง 6 ตัว จากอักษรไม่กำกวม 32 ตัว (ไม่มี 0 O 1 I) ใช้ gen_random_uuid() เป็นแหล่งสุ่ม
create or replace function public.nn_gen_code()
returns text
language plpgsql volatile
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  hex text := replace(gen_random_uuid()::text, '-', '');
  out text := '';
  i int;
begin
  for i in 1..6 loop
    out := out || substr(alphabet, (get_byte(decode(substr(hex, 2*i-1, 2), 'hex'), 0) % 32) + 1, 1);
  end loop;
  return out;
end;
$$;

-- เก็บกวาดห้องหมดอายุ (เรียกตอนมีคนสร้างห้อง จึงไม่ต้องพึ่ง cron)
create or replace function public.nn_cleanup()
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  update public.rooms
     set status = 'expired', updated_at = now()
   where status in ('lobby','playing') and expires_at < now();
  delete from public.rooms where created_at < now() - interval '1 day';
  delete from public.join_attempts where at < now() - interval '1 hour';
end;
$$;

-- สร้างห้อง
create or replace function public.nn_create_room(p_name text, p_avatar text, p_cap int, p_mode text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  nm text := public.nn_clean_name(p_name);
  av text := left(btrim(coalesce(p_avatar,'')), 20);
  rid uuid;
  cd text;
  tries int := 0;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if nm = '' then raise exception 'bad_name'; end if;
  if p_cap not in (120,150,200) then raise exception 'bad_cap'; end if;
  if p_mode not in ('one_loser','elimination') then raise exception 'bad_mode'; end if;

  perform public.nn_cleanup();

  if exists (
    select 1 from public.room_players rp join public.rooms r on r.id = rp.room_id
     where rp.user_id = uid and rp.left_at is null
       and r.status in ('lobby','playing') and r.expires_at > now()
  ) then raise exception 'already_in_room'; end if;

  if (select count(*) from public.rooms where host_user_id = uid and created_at > now() - interval '1 hour') >= 10
  then raise exception 'rate_limited'; end if;

  loop
    cd := public.nn_gen_code();
    exit when not exists (select 1 from public.rooms where code = cd);
    tries := tries + 1;
    if tries > 10 then raise exception 'code_generation_failed'; end if;
  end loop;

  insert into public.rooms (code, host_user_id, cap, mode)
  values (cd, uid, p_cap, p_mode)
  returning id into rid;

  insert into public.room_players (room_id, user_id, seat, player_name, avatar, is_host)
  values (rid, uid, 1, nm, av, true);

  return jsonb_build_object('room_id', rid, 'code', cd);
end;
$$;

-- เข้าห้อง
-- หมายเหตุ: ความผิดพลาดที่คาดได้ (รหัสผิด ห้องเต็ม ฯลฯ) ส่งกลับเป็น {error: '...'} แทนการ raise
-- เพื่อให้การนับ join_attempts ไม่ถูก rollback (ไม่งั้นกัน brute force ไม่ได้)
create or replace function public.nn_join_room(p_code text, p_name text, p_avatar text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  nm text := public.nn_clean_name(p_name);
  av text := left(btrim(coalesce(p_avatar,'')), 20);
  r public.rooms%rowtype;
  seat_no int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if nm = '' then return jsonb_build_object('error','bad_name'); end if;

  -- จำกัดอัตราการลองรหัส: ไม่เกิน 10 ครั้ง/นาที/ผู้ใช้
  delete from public.join_attempts where at < now() - interval '10 minutes';
  if (select count(*) from public.join_attempts where user_id = uid and at > now() - interval '1 minute') >= 10
  then return jsonb_build_object('error','rate_limited'); end if;
  insert into public.join_attempts (user_id) values (uid);

  select * into r from public.rooms
   where code = upper(btrim(coalesce(p_code,''))) for update;
  if not found then return jsonb_build_object('error','room_not_found'); end if;

  -- ถ้าเป็นสมาชิกห้องนี้อยู่แล้ว = กลับเข้าห้องเดิม (ไม่สร้างซ้ำ)
  if exists (select 1 from public.room_players where room_id = r.id and user_id = uid and left_at is null) then
    return jsonb_build_object('room_id', r.id, 'code', r.code, 'rejoined', true);
  end if;

  if r.status in ('closed','expired') or r.expires_at < now() then return jsonb_build_object('error','room_expired'); end if;
  if r.status <> 'lobby' then return jsonb_build_object('error','room_started'); end if;

  if exists (
    select 1 from public.room_players rp join public.rooms r2 on r2.id = rp.room_id
     where rp.user_id = uid and rp.left_at is null
       and r2.status in ('lobby','playing') and r2.expires_at > now()
  ) then return jsonb_build_object('error','already_in_room'); end if;

  if (select count(*) from public.room_players where room_id = r.id and left_at is null) >= r.max_players
  then return jsonb_build_object('error','room_full'); end if;

  if exists (select 1 from public.room_players
              where room_id = r.id and left_at is null and lower(player_name) = lower(nm))
  then return jsonb_build_object('error','name_taken'); end if;

  if av <> '' and exists (select 1 from public.room_players
              where room_id = r.id and left_at is null and avatar = av)
  then return jsonb_build_object('error','avatar_taken'); end if;

  select min(s) into seat_no
    from generate_series(1, r.max_players) s
   where not exists (select 1 from public.room_players
                      where room_id = r.id and left_at is null and seat = s);

  insert into public.room_players (room_id, user_id, seat, player_name, avatar)
  values (r.id, uid, seat_no, nm, av);

  update public.rooms set updated_at = now() where id = r.id;
  return jsonb_build_object('room_id', r.id, 'code', r.code, 'rejoined', false);
end;
$$;

-- ห้องที่ผู้ใช้อยู่ตอนนี้ (ใช้กลับเข้าห้องหลังรีเฟรช/หลุด)
create or replace function public.nn_my_room()
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (select jsonb_build_object('room_id', r.id, 'code', r.code, 'status', r.status)
       from public.room_players rp join public.rooms r on r.id = rp.room_id
      where rp.user_id = auth.uid() and rp.left_at is null
        and r.status in ('lobby','playing') and r.expires_at > now()
      order by rp.joined_at desc limit 1),
    'null'::jsonb);
$$;

-- กด Ready / Not Ready
create or replace function public.nn_set_ready(p_room uuid, p_ready boolean)
returns void
language plpgsql security definer
set search_path = public
as $$
declare r public.rooms%rowtype;
begin
  select * into r from public.rooms where id = p_room for update;
  if not found then raise exception 'room_not_found'; end if;
  if r.status <> 'lobby' then raise exception 'room_started'; end if;
  update public.room_players set is_ready = coalesce(p_ready,false)
   where room_id = p_room and user_id = auth.uid() and left_at is null;
  if not found then raise exception 'not_in_room'; end if;
  update public.rooms set updated_at = now() where id = p_room;
end;
$$;

-- host ปรับตั้งค่าห้อง (เพดาน/โหมด) ก่อนเริ่มเกม ; ทุกคนที่ Ready ไว้จะถูกรีเซ็ตเป็น Not Ready
create or replace function public.nn_update_settings(p_room uuid, p_cap int, p_mode text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare r public.rooms%rowtype;
begin
  select * into r from public.rooms where id = p_room for update;
  if not found then raise exception 'room_not_found'; end if;
  if r.host_user_id <> auth.uid() then raise exception 'not_host'; end if;
  if r.status <> 'lobby' then raise exception 'room_started'; end if;
  if p_cap not in (120,150,200) then raise exception 'bad_cap'; end if;
  if p_mode not in ('one_loser','elimination') then raise exception 'bad_mode'; end if;
  update public.rooms set cap = p_cap, mode = p_mode, updated_at = now() where id = p_room;
  update public.room_players set is_ready = false where room_id = p_room and left_at is null;
end;
$$;

-- ออกจากห้อง ; ถ้า host ออก โอน host ให้คนที่เข้าก่อน ; ถ้าไม่เหลือใคร ปิดห้อง
create or replace function public.nn_leave_room(p_room uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r public.rooms%rowtype;
  nxt uuid;
begin
  select * into r from public.rooms where id = p_room for update;
  if not found then raise exception 'room_not_found'; end if;
  update public.room_players
     set left_at = now(), is_ready = false, is_host = false
   where room_id = p_room and user_id = uid and left_at is null;
  if not found then raise exception 'not_in_room'; end if;

  select user_id into nxt from public.room_players
   where room_id = p_room and left_at is null
   order by joined_at, seat limit 1;

  if nxt is null then
    update public.rooms set status = 'closed', updated_at = now() where id = p_room;
  elsif r.host_user_id = uid then
    update public.rooms set host_user_id = nxt, updated_at = now() where id = p_room;
    update public.room_players set is_host = true
     where room_id = p_room and user_id = nxt and left_at is null;
  else
    update public.rooms set updated_at = now() where id = p_room;
  end if;
end;
$$;

-- host ปิดห้อง
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
  if r.status not in ('lobby','playing') then raise exception 'room_closed'; end if;
  update public.rooms set status = 'closed', updated_at = now() where id = p_room;
end;
$$;

-- host เริ่มเกม: ตรวจ 2-4 คน และทุกคน (รวม host) กด Ready แล้ว
-- (Phase 1 แค่เปลี่ยนสถานะเป็น 'playing' ; Phase 2 จะเพิ่มการแจกไพ่ในฟังก์ชัน/Edge Function)
create or replace function public.nn_start_game(p_room uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  r public.rooms%rowtype;
  n int;
  not_ready int;
begin
  select * into r from public.rooms where id = p_room for update;
  if not found then raise exception 'room_not_found'; end if;
  if r.host_user_id <> auth.uid() then raise exception 'not_host'; end if;
  if r.status <> 'lobby' then raise exception 'room_started'; end if;
  if r.expires_at < now() then raise exception 'room_expired'; end if;

  select count(*), count(*) filter (where not is_ready)
    into n, not_ready
    from public.room_players where room_id = p_room and left_at is null;

  if n < 2 or n > 4 then raise exception 'bad_player_count'; end if;
  if not_ready > 0 then raise exception 'not_all_ready'; end if;

  update public.rooms
     set status = 'playing', updated_at = now(), expires_at = now() + interval '6 hours'
   where id = p_room;
end;
$$;

-- ---------- สิทธิ์เรียกฟังก์ชัน: เฉพาะผู้ใช้ที่ล็อกอิน (รวม anonymous) ----------
do $$
declare f text;
begin
  foreach f in array array[
    'nn_create_room(text,text,int,text)',
    'nn_join_room(text,text,text)',
    'nn_my_room()',
    'nn_set_ready(uuid,boolean)',
    'nn_update_settings(uuid,int,text)',
    'nn_leave_room(uuid)',
    'nn_close_room(uuid)',
    'nn_start_game(uuid)',
    'nn_is_room_member(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  -- ฟังก์ชันภายใน ไม่ให้ client เรียกตรง ๆ
  revoke all on function public.nn_cleanup() from public, anon, authenticated;
  revoke all on function public.nn_gen_code() from public, anon, authenticated;
end $$;

-- ---------- Realtime ----------
do $$
begin
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms') then
    alter publication supabase_realtime add table public.rooms;
  end if;
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_players') then
    alter publication supabase_realtime add table public.room_players;
  end if;
end $$;
