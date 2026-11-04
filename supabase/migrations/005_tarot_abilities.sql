-- =====================================================================
-- HRTA Number Ceiling - Phase 5: Tarot ability/state upgrade
-- Run AFTER migrations 001-004 in Supabase SQL Editor.
-- Private Sun choices are stored only in the owning player's row.
-- =====================================================================

alter table public.player_private_states
  add column if not exists pending jsonb;

-- Remove the Phase 2 signature. Keeping both overloads can make future RPC
-- calls ambiguous and leaves an obsolete write path in the schema.
drop function if exists public.nn_commit_action(uuid,int,uuid,uuid,jsonb,jsonb,jsonb,int,int,timestamptz,jsonb);

-- Atomic state commit for card plays, interrupts, Sun picks, Chariot skips and forfeits.
-- p_hands now maps user_id -> { hand: [...], pending: {sunOptions:[...]} | null }.
-- On game start, nn_commit_start still receives the original user_id -> [...] hand map.
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
  if p_type not in ('play','interrupt','choose','skip','forfeit') then
    return jsonb_build_object('error','bad_type');
  end if;

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
     set deck = p_secret->'deck', disc = p_secret->'disc'
   where game_id = p_game;

  for k, v in select * from jsonb_each(coalesce(p_hands, '{}'::jsonb)) loop
    update public.player_private_states
       set hand = coalesce(v->'hand', hand),
           pending = v->'pending',
           updated_at = now()
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

-- The existing owner-only RLS policy on player_private_states applies to pending as well.
-- Do not create a public policy for game_secrets or private states.
