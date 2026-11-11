// เซิร์ฟเวอร์จำลองของ Popular Awards สำหรับเทสต์เท่านั้น — เลียนตรรกะของ supabase/migrations/008_popular_awards.sql
// (ตาราง/ฟังก์ชัน awd_* ในหน่วยความจำ ใช้ร่วมกันหลายเบราว์เซอร์) · ไม่ใช่ส่วนของแอป · node tests/e2e/awards-server.js [port]
const http = require("http");
const MEM = ["จ๊ะเอ๋", "นุ", "เบสท์", "เบียร์", "รุ่ง", "นิว", "ต๊ะ", "ปุ๊", "เจนนี่", "บุ๋ม", "บี", "เบล", "ฝน", "กระแต", "ทราย", "เจน", "ปีเตอร์", "ยุ้ย", "โม", "ฟิวส์"];
const CATS = [["vacuum", "1", "🍜", "The Human Vacuum", "กินเก่งที่สุด"], ["meme", "2", "😂", "The Walking Meme", "สายฮาที่สุด"], ["battery", "3", "🔋", "The Overcharged Battery", "พลังงานเยอะที่สุด"], ["camera", "4", "📸", "The Camera Magnet", "รูปเยอะที่สุด"], ["runway", "5", "👗", "The Walking Runway", "แต่งตัวมีสไตล์ที่สุด"], ["radio", "6", "📻", "The Human Radio", "คุยเก่งที่สุด"], ["confused", "7", "😵‍💫", "The \"What's Going On?\"", "ผู้ที่งงกับชีวิตที่สุด"], ["adventure", "8", "🎒", "The Adventure Seeker", "พร้อมลุยทุกกิจกรรมที่สุด"], ["caring", "9", "💗", "The Caring Soul", "ดูแลทุกคนดีที่สุด"], ["gift", "10", "🎁", "The Gift Guru", "เลือกของขวัญได้ดีและตรงโจทย์มากที่สุด"]].map(c => ({ id: c[0], ord: +c[1], emoji: c[2], en: c[3], th: c[4] }));
const OPEN = Date.parse("2026-11-13T00:00:00+07:00");
let V = new Map(), LOG = [];                       // key ns|voter|cat -> {nominee,edits,created,updated}
const err = m => { const e = new Error(m); e.expected = true; throw e; };
const cnt = (ns, voter) => CATS.filter(c => V.has(ns + "|" + voter + "|" + c.id)).length;
const allDone = ns => MEM.length > 0 && MEM.every(m => cnt(ns, m) >= CATS.length);
const chk = (u, ns) => { if (!u) err("not_authenticated"); if (ns !== "live" && ns !== "test") err("bad_ns"); };
const RPC = {
  awd_state(a, u, now) {
    chk(u, a.p_ns); const ns = a.p_ns; let me = null;
    const members = MEM.map(n => ({ name: n, done: cnt(ns, n) >= CATS.length })), ndone = members.filter(m => m.done).length;
    if (a.p_voter != null && MEM.includes(a.p_voter)) {
      if (cnt(ns, a.p_voter) >= CATS.length) me = { name: a.p_voter, done: true, votes: {} };
      else { const votes = {}; CATS.forEach(c => { const r = V.get(ns + "|" + a.p_voter + "|" + c.id); if (r) votes[c.id] = r.nominee; }); me = { name: a.p_voter, done: false, votes }; }
    }
    return { ns, open: ns === "test" || now >= OPEN, categories: CATS.map(c => ({ id: c.id, emoji: c.emoji, en: c.en, th: c.th })), members, total: MEM.length, done: ndone, all_done: MEM.length > 0 && ndone === MEM.length, me };
  },
  awd_vote(a, u, now) {
    chk(u, a.p_ns); const ns = a.p_ns;
    if (ns === "live" && now < OPEN) err("not_open");
    if (a.p_voter == null || a.p_nominee == null || a.p_category == null) err("bad_input");
    if (a.p_voter === a.p_nominee) err("self_vote");
    if (!MEM.includes(a.p_voter)) err("bad_voter"); if (!MEM.includes(a.p_nominee)) err("bad_nominee"); if (!CATS.some(c => c.id === a.p_category)) err("bad_category");
    if (ns === "live") { LOG = LOG.filter(t => now - t.at < 3600e3 * 2); if (LOG.filter(t => t.u === u && now - t.at < 3600e3).length >= 120) err("rate_limited"); LOG.push({ u, at: now }); }
    if (cnt(ns, a.p_voter) >= CATS.length) err("locked");
    const k = ns + "|" + a.p_voter + "|" + a.p_category, r = V.get(k);
    if (!r) V.set(k, { nominee: a.p_nominee, edits: 0, created: now, updated: now });
    else { if (r.nominee !== a.p_nominee) r.edits++; r.nominee = a.p_nominee; r.updated = now; }
    const c = cnt(ns, a.p_voter); return { saved: true, count: c, total: CATS.length, completed: c >= CATS.length, all_done: allDone(ns) };
  },
  awd_results(a, u) {
    chk(u, a.p_ns); const ns = a.p_ns;
    if (!allDone(ns)) { const pend = MEM.filter(m => cnt(ns, m) < CATS.length); return { ready: false, done: MEM.length - pend.length, total: MEM.length, pending: pend }; }
    return { ready: true, total: MEM.length, categories: CATS.map(c => {
      const t = {}; MEM.forEach(v => { const r = V.get(ns + "|" + v + "|" + c.id); if (r) t[r.nominee] = (t[r.nominee] || 0) + 1; });
      const tot = Object.values(t).reduce((x, y) => x + y, 0), rows = Object.keys(t).map(n => ({ name: n, votes: t[n], ord: MEM.indexOf(n) })).sort((x, y) => y.votes - x.votes || x.ord - y.ord);
      const ranks = rows.map(r => ({ name: r.name, votes: r.votes, rank: 1 + rows.filter(o => o.votes > r.votes).length, pct: Math.round(r.votes * 1000 / tot) / 10 })).filter(r => r.rank <= 3);
      return { id: c.id, emoji: c.emoji, en: c.en, th: c.th, voters: tot, ranks };
    }) };
  },
  awd_reset_test(a, u) { chk(u, "test"); for (const k of [...V.keys()]) if (k.startsWith("test|")) V.delete(k); return { ok: true }; },
  awd_seed_test(a, u) {
    chk(u, "test");
    MEM.forEach(m => { if (m === (a.p_except || "")) return; CATS.forEach(c => { const k = "test|" + m + "|" + c.id; if (!V.has(k)) { const o = MEM.filter(x => x !== m); V.set(k, { nominee: o[Math.floor(Math.random() * o.length)], edits: 0, created: 0, updated: 0 }); } }); });
    return { ok: true };
  }
};
const srv = http.createServer((req, res) => {
  const send = (o, c) => { res.writeHead(c || 200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" }); res.end(JSON.stringify(o)); };
  if (req.method === "OPTIONS") return send({});
  if (req.url === "/dump") { const o = {}; for (const [k, v] of V) o[k] = v; return send({ votes: o, nmem: MEM.length, ncat: CATS.length }); }
  if (req.url === "/force") { /* เทสต์เท่านั้น: เขียนคะแนนตรง ๆ {ns, votes:[[voter,cat,nominee],...]} */
    let b2 = ""; req.on("data", d => b2 += d); return req.on("end", () => { const j = JSON.parse(b2); j.votes.forEach(x => V.set(j.ns + "|" + x[0] + "|" + x[1], { nominee: x[2], edits: 0, created: 0, updated: 0 })); send({ ok: true }); }); }
  if (req.url === "/clear") { V = new Map(); LOG = []; return send({ ok: true }); }
  let body = ""; req.on("data", d => body += d); req.on("end", () => {
    const fn = (req.url.match(/^\/rpc\/(\w+)/) || [])[1], u = req.headers["x-user"], now = +req.headers["x-now"] || Date.now();
    try { if (!RPC[fn]) return send({ error: { message: "no_function" } }); send({ data: JSON.parse(JSON.stringify(RPC[fn](JSON.parse(body || "{}"), u, now))) }); }
    catch (e) { if (e.expected) send({ error: { message: e.message } }); else { console.error(e); send({ error: { message: "server_error" } }, 500); } }
  });
});
srv.listen(+process.argv[2] || 8772, () => console.log("awards mock server on", srv.address().port));
