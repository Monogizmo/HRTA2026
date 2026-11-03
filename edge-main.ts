// @ts-nocheck
// ไฟล์นี้สร้างอัตโนมัติจาก tools/build-edge.js — อย่าแก้ตรง ๆ (แก้ที่ online/*.js หรือ tools/edge-main.ts แล้วรัน: node tools/build-edge.js)
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
const self = globalThis;

/*__BUNDLE__*/

// ---------- ส่วนที่ผูกกับ Supabase/Deno ----------
const ALLOWED = (Deno.env.get("ALLOWED_ORIGINS") || "https://monogizmo.github.io").split(",").map((s) => s.trim());
const SB_URL = Deno.env.get("SUPABASE_URL");
// service_role อยู่ในสภาพแวดล้อมของ Edge Function เท่านั้น (ไม่เคยอยู่ในโค้ด/ GitHub)
const SB_KEY = Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const admin = createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

// ตัวสุ่มปลอดภัย 53 บิต ช่วง [0,1)
function rnd() {
  const b = new Uint32Array(2);
  crypto.getRandomValues(b);
  return (b[0] * 2097152 + (b[1] >>> 11)) / 9007199254740992;
}
const api = globalThis.NNApi.create({ admin, rnd, log: (...a) => console.error(...a) });

function corsHeaders(req) {
  const o = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED.includes(o) ? o : ALLOWED[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

Deno.serve(async (req) => {
  const h = corsHeaders(req);
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...h, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return json({ error: "bad_request" }, 405);

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "not_authenticated" }, 401);
  const { data, error } = await admin.auth.getUser(token);      // ตรวจ JWT จริง ไม่เชื่อ user id จาก body
  if (error || !data || !data.user) return json({ error: "not_authenticated" }, 401);

  let body;
  try { body = await req.json(); } catch (_) { return json({ error: "bad_request" }, 400); }
  const out = await api.handle(data.user.id, body);
  return json(out, out.error === "server_error" ? 500 : 200);
});
