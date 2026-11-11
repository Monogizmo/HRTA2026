-- =====================================================================
-- HRTA Popular Awards – Who's The Most?  (v41)
-- โหวตเพื่อนร่วมทีมในหัวข้อต่าง ๆ · ไม่มีระบบ Login · ใช้ Anonymous Auth ชุดเดียวกับ Quiz/ออนไลน์
--
-- หลักการ
--  • client อ่าน/เขียนตารางตรงไม่ได้ (เปิด RLS ไม่มี policy + เพิกถอนสิทธิ์) — ต้องผ่านฟังก์ชัน awd_* เท่านั้น
--  • awd_state    : สถานะสาธารณะ (ใคร Completed/Thinking) — ไม่มีข้อมูลว่าใครโหวตให้ใคร
--                   ถ้าส่งชื่อผู้โหวตที่ยังไม่ครบมา จะได้เฉพาะ "การโหวตของชื่อนั้น" กลับไป (เพื่อให้แก้ไขได้) ผู้ที่ครบแล้วจะไม่ได้รายละเอียดกลับไป
--  • awd_vote     : บันทึก/แก้ไขหนึ่งหัวข้อ (หนึ่งคนหนึ่งคะแนนต่อหัวข้อ, เลือกตัวเองไม่ได้) · ครบทุกหัวข้อแล้วล็อกถาวร
--  • awd_results  : คืนคะแนนรวมก็ต่อเมื่อสมาชิกทุกคนโหวตครบทุกหัวข้อเท่านั้น (ตรวจที่ฐานข้อมูล ไม่พึ่ง localStorage)
--  • ns = 'live' (ของจริง) / 'test' (โหมด #test — ข้อมูลแยกกันเด็ดขาด ล้างได้ด้วย awd_reset_test)
--
-- ข้อจำกัดด้านความปลอดภัย (ต้องรู้): ไม่มี Login จึง "ยืนยันไม่ได้ว่าคนที่เลือกชื่อเป็นเจ้าของชื่อจริง"
--  ใครก็เลือกชื่อของคนที่ยังโหวตไม่ครบแล้วโหวตแทนได้ (และเห็นเฉพาะคะแนนที่คนนั้นโหวตไว้บางส่วน) — เป็นกิจกรรมแบบไว้ใจกัน
--  กันได้เท่าที่ทำได้: ชื่อที่ครบแล้วเข้า/แก้ไม่ได้ · โควตา 120 ครั้ง/ชั่วโมง/ผู้ใช้ · ทุกอย่างตรวจฝั่งฐานข้อมูล
--
-- เปลี่ยนรายชื่อ/หัวข้อภายหลังแก้ที่ตาราง awd_members / awd_categories (ไม่ต้องแก้โค้ด) — ทำก่อนเริ่มโหวต
-- เวลาเปิดโหวตจริงอยู่ที่ awd_config.open_at (ค่าตั้งต้น 13 พ.ย. 2026 00:00 เวลาไทย)
-- รันซ้ำได้ (idempotent)
-- =====================================================================

create table if not exists public.awd_config (
  id      int primary key default 1 check (id = 1),
  open_at timestamptz not null
);
insert into public.awd_config (id, open_at) values (1, '2026-11-13 00:00:00+07') on conflict (id) do nothing;

create table if not exists public.awd_members (
  name text primary key check (char_length(name) between 1 and 40),
  ord  int  not null
);
create table if not exists public.awd_categories (
  id       text primary key check (id ~ '^[a-z0-9_]{1,30}$'),
  ord      int  not null,
  emoji    text not null,
  title_en text not null,
  title_th text not null
);

insert into public.awd_members (name, ord) values
  ('จ๊ะเอ๋', 1),
  ('นุ', 2),
  ('เบสท์', 3),
  ('เบียร์', 4),
  ('รุ่ง', 5),
  ('นิว', 6),
  ('ต๊ะ', 7),
  ('ปุ๊', 8),
  ('เจนนี่', 9),
  ('บุ๋ม', 10),
  ('บี', 11),
  ('เบล', 12),
  ('ฝน', 13),
  ('กระแต', 14),
  ('ทราย', 15),
  ('เจน', 16),
  ('ปีเตอร์', 17),
  ('ยุ้ย', 18),
  ('โม', 19),
  ('ฟิวส์', 20)
on conflict (name) do nothing;

insert into public.awd_categories (id, ord, emoji, title_en, title_th) values
  ('vacuum', 1, '🍜', 'The Human Vacuum', 'กินเก่งที่สุด'),
  ('meme', 2, '😂', 'The Walking Meme', 'สายฮาที่สุด'),
  ('battery', 3, '🔋', 'The Overcharged Battery', 'พลังงานเยอะที่สุด'),
  ('camera', 4, '📸', 'The Camera Magnet', 'รูปเยอะที่สุด'),
  ('runway', 5, '👗', 'The Walking Runway', 'แต่งตัวมีสไตล์ที่สุด'),
  ('radio', 6, '📻', 'The Human Radio', 'คุยเก่งที่สุด'),
  ('confused', 7, '😵‍💫', 'The "What''s Going On?"', 'ผู้ที่งงกับชีวิตที่สุด'),
  ('adventure', 8, '🎒', 'The Adventure Seeker', 'พร้อมลุยทุกกิจกรรมที่สุด'),
  ('caring', 9, '💗', 'The Caring Soul', 'ดูแลทุกคนดีที่สุด'),
  ('gift', 10, '🎁', 'The Gift Guru', 'เลือกของขวัญได้ดีและตรงโจทย์มากที่สุด')
on conflict (id) do nothing;

-- หนึ่งแถว = ผู้โหวต 1 คน × หัวข้อ 1 หัวข้อ (primary key กันโหวตซ้ำ) · แก้คะแนน = update แถวเดิม
create table if not exists public.awd_votes (
  ns         text not null check (ns in ('live','test')),
  voter      text not null references public.awd_members(name) on update cascade on delete cascade,
  category   text not null references public.awd_categories(id) on update cascade on delete cascade,
  nominee    text not null references public.awd_members(name) on update cascade on delete cascade,
  created_at timestamptz not null default now(),   -- เวลาที่ส่งครั้งแรก
  updated_at timestamptz not null default now(),   -- เวลาที่แก้ล่าสุด
  edits      int not null default 0,               -- จำนวนครั้งที่เปลี่ยนผู้ได้รับคะแนน
  primary key (ns, voter, category),
  check (voter <> nominee)
);
create index if not exists awd_votes_tally on public.awd_votes (ns, category, nominee);

create table if not exists public.awd_log (
  id      bigint generated always as identity primary key,
  user_id uuid not null,
  at      timestamptz not null default now()
);
create index if not exists awd_log_user_at on public.awd_log (user_id, at);

alter table public.awd_config     enable row level security;   -- ไม่มี policy = client เข้าถึงตรงไม่ได้
alter table public.awd_members    enable row level security;
alter table public.awd_categories enable row level security;
alter table public.awd_votes      enable row level security;
alter table public.awd_log        enable row level security;
revoke all on table public.awd_config, public.awd_members, public.awd_categories, public.awd_votes, public.awd_log from anon, authenticated;

-- ภายใน: ทุกคนโหวตครบทุกหัวข้อแล้วหรือยัง (ไม่ให้ client เรียกตรง)
create or replace function public.awd_all_done(p_ns text)
returns boolean language sql stable security definer set search_path = public as $$
  select (select count(*) from awd_members) > 0
     and (select count(*) from awd_categories) > 0
     and not exists (
       select 1 from awd_members m
       where (select count(*) from awd_votes v where v.ns = p_ns and v.voter = m.name)
             < (select count(*) from awd_categories));
$$;

-- สถานะสาธารณะ + (ถ้าระบุ p_voter) การโหวตของตัวเอง
create or replace function public.awd_state(p_ns text default 'live', p_voter text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ncat int; nmem int; ndone int; cfg timestamptz; mine jsonb := null; me_n int; mem jsonb; cat jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_ns not in ('live','test') then raise exception 'bad_ns'; end if;
  select count(*) into ncat from awd_categories;
  select count(*) into nmem from awd_members;
  select open_at into cfg from awd_config where id = 1;

  select coalesce(jsonb_agg(jsonb_build_object('name', m.name, 'done', coalesce(c.n, 0) >= ncat) order by m.ord), '[]'::jsonb),
         count(*) filter (where coalesce(c.n, 0) >= ncat)
    into mem, ndone
    from awd_members m
    left join (select voter, count(*) n from awd_votes where ns = p_ns group by voter) c on c.voter = m.name;

  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'emoji', emoji, 'en', title_en, 'th', title_th) order by ord), '[]'::jsonb)
    into cat from awd_categories;

  if p_voter is not null and exists (select 1 from awd_members where name = p_voter) then
    select count(*) into me_n from awd_votes where ns = p_ns and voter = p_voter;
    if me_n >= ncat then
      mine := jsonb_build_object('name', p_voter, 'done', true, 'votes', '{}'::jsonb);      -- ครบแล้ว: ไม่ส่งรายละเอียดกลับ
    else
      mine := jsonb_build_object('name', p_voter, 'done', false, 'votes',
        coalesce((select jsonb_object_agg(category, nominee) from awd_votes where ns = p_ns and voter = p_voter), '{}'::jsonb));
    end if;
  end if;

  return jsonb_build_object(
    'ns', p_ns, 'open', (p_ns = 'test' or now() >= cfg), 'open_at', cfg,
    'categories', cat, 'members', mem, 'total', nmem, 'done', ndone,
    'all_done', (nmem > 0 and ndone = nmem), 'me', mine);
end; $$;

-- โหวต/แก้ไขหนึ่งหัวข้อ · ครบทุกหัวข้อ = ล็อก
create or replace function public.awd_vote(p_ns text, p_voter text, p_category text, p_nominee text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); ncat int; cnt int; cfg timestamptz;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_ns not in ('live','test') then raise exception 'bad_ns'; end if;
  select open_at into cfg from awd_config where id = 1;
  if p_ns = 'live' and now() < cfg then raise exception 'not_open'; end if;
  if p_voter is null or p_nominee is null or p_category is null then raise exception 'bad_input'; end if;
  if p_voter = p_nominee then raise exception 'self_vote'; end if;
  if not exists (select 1 from awd_members where name = p_voter) then raise exception 'bad_voter'; end if;
  if not exists (select 1 from awd_members where name = p_nominee) then raise exception 'bad_nominee'; end if;
  if not exists (select 1 from awd_categories where id = p_category) then raise exception 'bad_category'; end if;

  if p_ns = 'live' then
    delete from awd_log where at < now() - interval '2 hours';
    if (select count(*) from awd_log where user_id = uid and at > now() - interval '1 hour') >= 120 then
      raise exception 'rate_limited';
    end if;
    insert into awd_log (user_id) values (uid);
  end if;

  perform pg_advisory_xact_lock(hashtext(p_ns || ':' || p_voter));      -- กันส่งพร้อมกันของคนเดียวกัน (ตรวจ "ครบ" แล้วล็อกอย่างปลอดภัย)
  select count(*) into ncat from awd_categories;
  select count(*) into cnt from awd_votes where ns = p_ns and voter = p_voter;
  if cnt >= ncat then raise exception 'locked'; end if;

  insert into awd_votes as v (ns, voter, category, nominee)
  values (p_ns, p_voter, p_category, p_nominee)
  on conflict (ns, voter, category) do update
     set nominee    = excluded.nominee,
         updated_at = now(),
         edits      = v.edits + (case when v.nominee <> excluded.nominee then 1 else 0 end);

  select count(*) into cnt from awd_votes where ns = p_ns and voter = p_voter;
  return jsonb_build_object('saved', true, 'count', cnt, 'total', ncat, 'completed', cnt >= ncat, 'all_done', awd_all_done(p_ns));
end; $$;

-- ผลประกาศรางวัล: คืนคะแนนก็ต่อเมื่อทุกคนครบ · อันดับแบบ competition (คะแนนเท่ากันได้อันดับเดียวกัน → ผู้ชนะร่วม)
create or replace function public.awd_results(p_ns text default 'live')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  nmem int; ndone int; c record; tot int; ranks jsonb; acc jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_ns not in ('live','test') then raise exception 'bad_ns'; end if;
  if not awd_all_done(p_ns) then
    select count(*) into nmem from awd_members;
    select count(*) into ndone from awd_members m
      where (select count(*) from awd_votes v where v.ns = p_ns and v.voter = m.name) >= (select count(*) from awd_categories);
    return jsonb_build_object('ready', false, 'done', ndone, 'total', nmem,
      'pending', coalesce((select jsonb_agg(m.name order by m.ord) from awd_members m
                           where (select count(*) from awd_votes v where v.ns = p_ns and v.voter = m.name) < (select count(*) from awd_categories)), '[]'::jsonb));
  end if;

  for c in select * from awd_categories order by ord loop
    select count(*) into tot from awd_votes where ns = p_ns and category = c.id;
    select coalesce(jsonb_agg(jsonb_build_object('name', x.nominee, 'votes', x.n, 'rank', x.rk, 'pct', round(x.n * 100.0 / nullif(tot, 0), 1)) order by x.rk, x.ord), '[]'::jsonb)
      into ranks
      from (select t.nominee, t.n, t.ord, rank() over (order by t.n desc) rk
              from (select v.nominee, count(*)::int n, m.ord
                      from awd_votes v join awd_members m on m.name = v.nominee
                     where v.ns = p_ns and v.category = c.id
                     group by v.nominee, m.ord) t) x
     where x.rk <= 3;
    acc := acc || jsonb_build_array(jsonb_build_object('id', c.id, 'emoji', c.emoji, 'en', c.title_en, 'th', c.title_th, 'voters', tot, 'ranks', ranks));
  end loop;
  select count(*) into nmem from awd_members;
  return jsonb_build_object('ready', true, 'total', nmem, 'categories', acc);
end; $$;

-- เฉพาะโหมดทดสอบ (#test): ล้างข้อมูลทดสอบ / จำลองให้ทุกคนยกเว้นหนึ่งคนโหวตครบ — แตะ ns='live' ไม่ได้
create or replace function public.awd_reset_test()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  delete from awd_votes where ns = 'test';
  return jsonb_build_object('ok', true);
end; $$;

create or replace function public.awd_seed_test(p_except text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  insert into awd_votes (ns, voter, category, nominee)
  select 'test', m.name, c.id,
         (select m2.name from awd_members m2 where m2.name <> m.name order by random() limit 1)
    from awd_members m cross join awd_categories c
   where m.name <> coalesce(p_except, '')
  on conflict (ns, voter, category) do nothing;
  return jsonb_build_object('ok', true);
end; $$;

revoke all on function public.awd_all_done(text) from public, anon, authenticated;
revoke all on function public.awd_state(text, text) from public, anon;
revoke all on function public.awd_vote(text, text, text, text) from public, anon;
revoke all on function public.awd_results(text) from public, anon;
revoke all on function public.awd_reset_test() from public, anon;
revoke all on function public.awd_seed_test(text) from public, anon;
grant execute on function public.awd_state(text, text) to authenticated;
grant execute on function public.awd_vote(text, text, text, text) to authenticated;
grant execute on function public.awd_results(text) to authenticated;
grant execute on function public.awd_reset_test() to authenticated;
grant execute on function public.awd_seed_test(text) to authenticated;
