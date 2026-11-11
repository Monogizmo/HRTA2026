-- =====================================================================
-- Phase C: สงครามไพ่ "ยุทธวิธี" ออนไลน์ 2 คน (ใช้ห้อง/เกม/heartbeat/rematch ชุดเดียวกับเกมเลขเพดาน)
-- ปลอดภัยต่อข้อมูลเดิม: เพิ่มคอลัมน์ที่มีค่าเริ่มต้น + ฟังก์ชันใหม่เท่านั้น ห้องเลขเพดานเดิมเป็น game_type = 'nn'
-- (เลข 005 ถูกใช้โดย 005_new_card_powers.sql แล้ว จึงใช้ 006)
--
-- การเก็บข้อมูลของสงครามไพ่ในตารางเดิม:
--   games.public_state            = สถานะสาธารณะ (ใครยืนยันแล้ว, ไพ่ที่เปิดแล้ว, จำนวนไพ่ ฯลฯ) — ไม่มีมือ/กองจั่ว/ไพ่ที่เลือกแต่ยังไม่เปิด
--   games.cur_p                   = -1 (ไม่มี "ตา" ในเกมเลือกพร้อมกัน)
--   game_secrets.deck             = กองจั่ว (ลับ)
--   game_secrets.disc             = สถานะลับอื่น ๆ ของ engine (กองรางวัล/ทิ้ง/โต๊ะ/ไพ่คว่ำ ฯลฯ) — ชื่อคอลัมน์เดิมเพื่อไม่ต้องแก้ตาราง
--   game_secrets.pend             = [ไพ่ที่ A เลือก|null, ไพ่ที่ B เลือก|null]  ← commit–reveal: อ่านได้เฉพาะ service_role
--   player_private_states.hand    = มือของผู้เล่นนั้น (RLS: เห็นเฉพาะเจ้าของ)
--   games.loser_p                 = ที่นั่ง(ดัชนี)ของผู้แพ้ ; เสมอ = null แต่ status = 'finished'
-- =====================================================================

alter table public.rooms add column if not exists game_type text not null default 'nn';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'rooms_game_type_check') then
    alter table public.rooms add constraint rooms_game_type_check check (game_type in ('nn','war'));
  end if;
end $$;
alter table public.rooms add column if not exists war_cfg jsonb;

-- ---------- ตั้งค่าห้องสงครามไพ่ (Host เท่านั้น) ----------
create or replace function public.war_clean_cfg(p jsonb)
returns jsonb language plpgsql immutable as $$
declare cl text := coalesce(p->>'clash','u'); fl int := case when coalesce(p->>'fool','1') in ('1','true') then 1 else 0 end;
begin
  if cl not in ('u','un','eq') then raise exception 'bad_cfg'; end if;
  return jsonb_build_object('clash', cl, 'fool', fl);
end; $$;

create or replace function public.war_create_room(p_name text, p_avatar text, p_cfg jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  nm text := public.nn_clean_name(p_name);
  av text := left(btrim(coalesce(p_avatar,'')), 20);
  cfg jsonb := public.war_clean_cfg(p_cfg);
  rid uuid; cd text; tries int := 0;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if nm = '' then raise exception 'bad_name'; end if;
  perform public.nn_cleanup();
  if exists (
    select 1 from public.room_players rp join public.rooms r on r.id = rp.room_id
     where rp.user_id = uid and rp.left_at is null and r.status in ('lobby','playing') and r.expires_at > now()
  ) then raise exception 'already_in_room'; end if;
  if (select count(*) from public.rooms where host_user_id = uid and created_at > now() - interval '1 hour') >= 10
  then raise exception 'rate_limited'; end if;
  loop
    cd := public.nn_gen_code();
    exit when not exists (select 1 from public.rooms where code = cd);
    tries := tries + 1;
    if tries > 10 then raise exception 'code_generation_failed'; end if;
  end loop;
  insert into public.rooms (code, host_user_id, max_players, game_type, war_cfg)
  values (cd, uid, 2, 'war', cfg) returning id into rid;
  insert into public.room_players (room_id, user_id, seat, player_name, avatar, is_host)
  values (rid, uid, 1, nm, av, true);
  return jsonb_build_object('room_id', rid, 'code', cd);
end; $$;

create or replace function public.war_update_settings(p_room uuid, p_cfg jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare r public.rooms%rowtype;
begin
  select * into r from public.rooms where id = p_room for update;
  if not found then raise exception 'room_not_found'; end if;
  if r.game_type <> 'war' then raise exception 'wrong_game_type'; end if;
  if r.host_user_id <> auth.uid() then raise exception 'not_host'; end if;
  if r.status <> 'lobby' then raise exception 'room_started'; end if;
  update public.rooms set war_cfg = public.war_clean_cfg(p_cfg), updated_at = now() where id = p_room;
  update public.room_players set is_ready = false where room_id = p_room and left_at is null;   -- เปลี่ยนกติกา = ทุกคนต้องกดพร้อมใหม่
end; $$;

-- กันใช้ตัวตั้งค่าเลขเพดานกับห้องสงครามไพ่ (พฤติกรรมเดิมของห้อง nn ไม่เปลี่ยน)
create or replace function public.nn_update_settings(p_room uuid, p_cap int, p_mode text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.rooms%rowtype;
begin
  select * into r from public.rooms where id = p_room for update;
  if not found then raise exception 'room_not_found'; end if;
  if r.game_type <> 'nn' then raise exception 'wrong_game_type'; end if;
  if r.host_user_id <> auth.uid() then raise exception 'not_host'; end if;
  if r.status <> 'lobby' then raise exception 'room_started'; end if;
  if p_cap not in (120,150,200) then raise exception 'bad_cap'; end if;
  if p_mode not in ('one_loser','elimination') then raise exception 'bad_mode'; end if;
  update public.rooms set cap = p_cap, mode = p_mode, updated_at = now() where id = p_room;
  update public.room_players set is_ready = false where room_id = p_room and left_at is null;
end; $$;

-- ---------- เริ่มเกม (เรียกโดย Edge Function เท่านั้น) ----------
create or replace function public.war_commit_start(
  p_room uuid, p_host uuid, p_public jsonb, p_secret jsonb, p_hands jsonb, p_deadline timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.rooms%rowtype; n int; not_ready int; matched int; keys int; gid uuid; rno int; k text; v jsonb;
begin
  select * into r from public.rooms where id = p_room for update;
  if not found then return jsonb_build_object('error','room_not_found'); end if;
  if r.game_type <> 'war' then return jsonb_build_object('error','wrong_game'); end if;
  if r.host_user_id <> p_host then return jsonb_build_object('error','not_host'); end if;
  if r.status <> 'lobby' then return jsonb_build_object('error','room_started'); end if;
  if r.expires_at < now() then return jsonb_build_object('error','room_expired'); end if;
  if (p_public->'cfg') is distinct from r.war_cfg then return jsonb_build_object('error','stale'); end if;
  select count(*), count(*) filter (where not is_ready) into n, not_ready
    from public.room_players where room_id = p_room and left_at is null;
  if n <> 2 then return jsonb_build_object('error','bad_player_count'); end if;
  if not_ready > 0 then return jsonb_build_object('error','not_all_ready'); end if;
  select count(*) into keys from jsonb_object_keys(p_hands);
  select count(*) into matched from public.room_players rp
   where rp.room_id = p_room and rp.left_at is null and jsonb_exists(p_hands, rp.user_id::text);
  if keys <> n or matched <> n then return jsonb_build_object('error','stale'); end if;
  select coalesce(max(round_no),0) + 1 into rno from public.games where room_id = p_room;
  insert into public.games (room_id, round_no, public_state, cur_p, turn_deadline_at)
  values (p_room, rno, p_public, -1, p_deadline) returning id into gid;
  insert into public.game_secrets (game_id, deck, disc, pend)
  values (gid, p_secret->'deck', p_secret->'rest', case when jsonb_typeof(p_secret->'pend') = 'array' then p_secret->'pend' else null end);
  for k, v in select * from jsonb_each(p_hands) loop
    insert into public.player_private_states (game_id, user_id, seat, hand)
    select gid, rp.user_id, rp.seat, v from public.room_players rp
     where rp.room_id = p_room and rp.left_at is null and rp.user_id = k::uuid;
  end loop;
  update public.rooms set status = 'playing', updated_at = now(), expires_at = now() + interval '6 hours' where id = p_room;
  return jsonb_build_object('game_id', gid, 'round', rno);
end; $$;

-- ---------- บันทึกการเลือก (commit) / ผลการเปิดไพ่ (reveal+resolve) / ยอมแพ้ ----------
-- p_over: -1 = เกมดำเนินต่อ · 0/1 = ผู้แพ้ (ดัชนีผู้เล่น) · -2 = จบแบบเสมอ
create or replace function public.war_commit(
  p_game uuid, p_expected int, p_user uuid, p_request uuid,
  p_public jsonb, p_secret jsonb, p_hands jsonb, p_over int,
  p_deadline timestamptz, p_type text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare g public.games%rowtype; nv int; k text; v jsonb;
begin
  if p_type not in ('choice','resolve','forfeit') then return jsonb_build_object('error','bad_type'); end if;
  select * into g from public.games where id = p_game for update;
  if not found then return jsonb_build_object('error','game_not_found'); end if;
  if not exists (select 1 from public.rooms where id = g.room_id and game_type = 'war') then
    return jsonb_build_object('error','wrong_game');
  end if;
  if exists (select 1 from public.game_actions where game_id = p_game and request_id = p_request) then
    return jsonb_build_object('ok', true, 'dup', true, 'version', g.version);
  end if;
  if g.status <> 'playing' then return jsonb_build_object('error','game_over'); end if;
  if g.version <> p_expected then return jsonb_build_object('error','stale','version', g.version); end if;
  nv := g.version + 1;
  update public.games
     set version = nv, public_state = p_public,
         loser_p = case when p_over >= 0 then p_over else null end,
         status = case when p_over <> -1 then 'finished' else 'playing' end,
         turn_deadline_at = case when p_over <> -1 then null else p_deadline end,
         finished_at = case when p_over <> -1 then now() else null end,
         updated_at = now()
   where id = p_game;
  update public.game_secrets
     set deck = p_secret->'deck', disc = p_secret->'rest',
         pend = case when jsonb_typeof(p_secret->'pend') = 'array' then p_secret->'pend' else null end
   where game_id = p_game;
  for k, v in select * from jsonb_each(p_hands) loop
    update public.player_private_states set hand = v, updated_at = now()
     where game_id = p_game and user_id = k::uuid;
  end loop;
  -- game_actions เก็บแค่ชนิดเหตุการณ์ (ไม่เก็บไพ่ที่เลือก)
  insert into public.game_actions (game_id, seq, user_id, request_id, action_type, payload)
  values (p_game, nv, p_user, p_request, p_type, jsonb_build_object('t', p_type));
  if p_over <> -1 then
    update public.rooms set status = 'finished', updated_at = now() where id = g.room_id;
  end if;
  return jsonb_build_object('ok', true, 'version', nv);
end; $$;

-- ---------- nn_heartbeat: เพิ่มช่วงผ่อนผันตอนกลับมาหลังหลุดสำหรับสงครามไพ่ (พฤติกรรมของเกมเลขเพดานไม่เปลี่ยน) ----------
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
  wp int;
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
    -- สงครามไพ่ยุทธวิธี (cur_p = -1, เลือกพร้อมกัน): กลับมาหลังหลุดและยังไม่ได้ยืนยันการเลือก → ให้เวลาอย่างน้อย 30 วินาที
    select (ord - 1)::int into wp
      from public.games g, jsonb_array_elements(g.public_state->'players') with ordinality as t(e, ord)
     where g.room_id = p_room and g.status = 'playing' and g.cur_p = -1 and (e->>'seat')::int = me.seat
     order by g.round_no desc limit 1;
    if wp is not null then
      update public.games
         set turn_deadline_at = greatest(coalesce(turn_deadline_at, now()), now() + interval '30 seconds')
       where room_id = p_room and status = 'playing' and cur_p = -1 and (public_state->'cm'->wp) = 'false'::jsonb;
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

-- ---------- สิทธิ์ ----------
do $$
declare f text;
begin
  foreach f in array array['war_create_room(text,text,jsonb)', 'war_update_settings(uuid,jsonb)', 'nn_update_settings(uuid,int,text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  revoke all on function public.war_clean_cfg(jsonb) from public, anon, authenticated;
  revoke all on function public.war_commit_start(uuid,uuid,jsonb,jsonb,jsonb,timestamptz) from public, anon, authenticated;
  revoke all on function public.war_commit(uuid,int,uuid,uuid,jsonb,jsonb,jsonb,int,timestamptz,text) from public, anon, authenticated;
  grant execute on function public.war_commit_start(uuid,uuid,jsonb,jsonb,jsonb,timestamptz) to service_role;
  grant execute on function public.war_commit(uuid,int,uuid,uuid,jsonb,jsonb,jsonb,int,timestamptz,text) to service_role;
end $$;
-- war_create_room / war_update_settings เรียก war_clean_cfg ภายใน security definer จึงทำงานได้โดยไม่ต้อง grant ให้ client
