-- =====================================================================
-- HRTA Online Multiplayer - Phase 4: เปิดโหมด "คัดออก" (elimination)
-- รันต่อจาก 001–003 (SQL Editor > New query > วาง > Run)
-- เปลี่ยนอย่างเดียว: nn_commit_start ไม่ปฏิเสธโหมด elimination อีกต่อไป (ตรรกะคัดออกอยู่ใน Edge Function)
-- =====================================================================
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
  if r.mode not in ('one_loser','elimination') then return jsonb_build_object('error','bad_mode'); end if;
  if (p_public->>'cap')::int <> r.cap then return jsonb_build_object('error','stale'); end if;
  if p_public->>'mode' <> r.mode then return jsonb_build_object('error','stale'); end if;

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

revoke all on function public.nn_commit_start(uuid,uuid,jsonb,jsonb,jsonb,int,timestamptz) from public, anon, authenticated;
grant execute on function public.nn_commit_start(uuid,uuid,jsonb,jsonb,jsonb,int,timestamptz) to service_role;
