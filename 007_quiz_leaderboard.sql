-- =====================================================================
-- Quiz Leaderboard (ทั้งทีม): ใครได้คะแนนสูงสุดเท่าไหร่ เล่นกี่ครั้ง
-- ใช้การล็อกอินแบบไม่ระบุตัวตน (Anonymous sign-in) ชุดเดียวกับโหมดออนไลน์ · client เขียน/อ่านตารางตรงไม่ได้ ต้องผ่านฟังก์ชันด้านล่างเท่านั้น
-- หมายเหตุความน่าเชื่อถือ: เป็นกระดานแข่งกันในทีมแบบไว้ใจกัน — ชื่อมาจากรายชื่อในแอป ระบบไม่ได้ยืนยันตัวตนว่าเป็นเจ้าของชื่อจริง
-- (กันการยิงรัวด้วยโควตา 30 ครั้ง/ชั่วโมง/ผู้ใช้ และคะแนนต้องอยู่ในช่วง 0–20)
-- =====================================================================

create table if not exists public.quiz_scores (
  player_name text primary key check (char_length(player_name) between 1 and 40),
  best        smallint not null check (best between 0 and 20),
  last_score  smallint not null check (last_score between 0 and 20),
  plays       int      not null default 1 check (plays >= 1),
  total       int      not null default 0,            -- ผลรวมคะแนนทุกครั้ง (หาค่าเฉลี่ย = total / plays)
  first_at    timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create table if not exists public.quiz_log (
  id      bigint generated always as identity primary key,
  user_id uuid not null,
  at      timestamptz not null default now()
);
create index if not exists quiz_log_user_at on public.quiz_log (user_id, at);

alter table public.quiz_scores enable row level security;   -- ไม่มี policy = client เข้าถึงตรงไม่ได้
alter table public.quiz_log    enable row level security;

-- ล้างชื่อ (ตัดอักขระอันตราย/ช่องว่างซ้ำ จำกัด 40 ตัวอักษร — ต่างจาก nn_clean_name ที่ตัดที่ 12 เพราะชื่อในรายชื่ออาจยาวกว่า)
create or replace function public.quiz_clean_name(p text)
returns text language sql immutable as $$
  select left(btrim(regexp_replace(regexp_replace(coalesce(p,''), '[<>&"''`[:cntrl:]]', '', 'g'), '\s+', ' ', 'g')), 40);
$$;

create or replace function public.quiz_submit(p_name text, p_score int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  nm  text := public.quiz_clean_name(p_name);
  r   public.quiz_scores%rowtype;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if nm = '' then raise exception 'bad_name'; end if;
  if p_score is null or p_score < 0 or p_score > 20 then raise exception 'bad_score'; end if;
  delete from public.quiz_log where at < now() - interval '2 hours';
  if (select count(*) from public.quiz_log where user_id = uid and at > now() - interval '1 hour') >= 30 then
    raise exception 'rate_limited';
  end if;
  insert into public.quiz_log (user_id) values (uid);
  insert into public.quiz_scores as q (player_name, best, last_score, plays, total)
  values (nm, p_score, p_score, 1, p_score)
  on conflict (player_name) do update
     set best = greatest(q.best, excluded.best), last_score = excluded.last_score,
         plays = q.plays + 1, total = q.total + excluded.last_score, updated_at = now()
  returning * into r;
  return jsonb_build_object('name', r.player_name, 'best', r.best, 'plays', r.plays);
end; $$;

-- อันดับ: คะแนนสูงสุดมาก→น้อย, เท่ากันดูคนที่เล่นน้อยครั้งกว่า, แล้วดูคนที่ทำได้ก่อน
create or replace function public.quiz_leaderboard()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'name', s.player_name, 'best', s.best, 'last', s.last_score, 'plays', s.plays,
             'avg', round(s.total::numeric / s.plays, 1), 'at', s.updated_at) order by s.best desc, s.plays asc, s.updated_at asc)
      from (select * from public.quiz_scores order by best desc, plays asc, updated_at asc limit 100) s
  ), '[]'::jsonb);
end; $$;

revoke all on function public.quiz_clean_name(text) from public, anon, authenticated;
revoke all on function public.quiz_submit(text, int) from public, anon;
revoke all on function public.quiz_leaderboard() from public, anon;
grant execute on function public.quiz_submit(text, int) to authenticated;
grant execute on function public.quiz_leaderboard() to authenticated;
