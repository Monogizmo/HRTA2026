-- =====================================================================
-- v43: เปลี่ยนหัวข้อ Popular Awards (Who's The Most...?) เป็นชุดใหม่ 10 หัวข้อ
-- รันบน Supabase ที่เคยรัน 008 ไปแล้ว (รันซ้ำได้) · ติดตั้งใหม่ที่รัน 008 (ฉบับ v43) อยู่แล้วไม่ต้องรันไฟล์นี้
-- ทำก่อนเริ่มโหวตจริง: การลบหัวข้อเก่าจะลบคะแนนของหัวข้อนั้นทิ้งด้วย (cascade)
-- คำอธิบายใต้ชื่อหัวข้อ (ตัวหนังสือเล็ก ๆ) อยู่ใน index.html (AW_DESC) ไม่ได้อยู่ในฐานข้อมูล
-- =====================================================================
delete from public.awd_votes where ns = 'test';   -- ล้างข้อมูลทดสอบของหัวข้อชุดเก่า

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
on conflict (id) do update set ord = excluded.ord, emoji = excluded.emoji, title_en = excluded.title_en, title_th = excluded.title_th;

delete from public.awd_categories
 where id in ('foodie', 'comedy', 'energy', 'paparazzi', 'style', 'butterfly', 'shopaholic', 'timekeeper');

-- ตรวจ: ต้องได้ 10 แถว
select id, ord, title_en, title_th from public.awd_categories order by ord;
