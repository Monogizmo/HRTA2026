// เซิร์ฟเวอร์จำลองสำหรับทดสอบ 2 เบราว์เซอร์จริง: เก็บตาราง/ฟังก์ชัน RPC ในหน่วยความจำ (เลียน SQL ใน 001/006) + รันตรรกะ Edge Function ตัวจริง (NNApi)
// ใช้ผ่าน: node tests/e2e/two-ctx-server.js [port]   (ใช้เฉพาะเทสต์ — ไม่ใช่ส่วนของแอป)
const http = require("http"), crypto = require("crypto");
const Api = require("../../online/nn-api-core.js");
const uuid = () => crypto.randomUUID(), clone = x => JSON.parse(JSON.stringify(x));
const T = { rooms: [], room_players: [], games: [], game_secrets: [], player_private_states: [], game_actions: [], player_heartbeats: [] };
let VER = 0;
function builder(name) {
  let filters = [], ord = null, desc = false, lim = null;
  const b = { select() { return b }, eq(k, v) { filters.push(r => r[k] === v); return b }, is(k, v) { filters.push(r => (v === null ? r[k] == null : r[k] === v)); return b },
    order(k, o) { ord = k; desc = o && o.ascending === false; return b }, limit(n) { lim = n; return b },
    _run() { let r = T[name].filter(x => filters.every(f => f(x))); if (ord) r = r.slice().sort((a, c) => desc ? c[ord] - a[ord] : a[ord] - c[ord]); if (lim != null) r = r.slice(0, lim); return clone(r) },
    maybeSingle() { return Promise.resolve({ data: b._run()[0] || null, error: null }) }, then(res, rej) { return Promise.resolve({ data: b._run(), error: null }).then(res, rej) } };
  return b;
}
const err = m => { const e = new Error(m); e.expected = true; throw e };
const activeP = rid => T.room_players.filter(p => p.room_id === rid && !p.left_at);
const code = () => { const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = ""; for (let i = 0; i < 6; i++) s += A[Math.floor(Math.random() * A.length)]; return s };
const RPC = {
  war_create_room(a, u) {
    if (T.room_players.some(p => p.user_id === u && !p.left_at && T.rooms.find(r => r.id === p.room_id && ["lobby", "playing"].includes(r.status)))) err("already_in_room");
    const cl = a.p_cfg && a.p_cfg.clash || "u"; if (!["u", "un", "eq"].includes(cl)) err("bad_cfg");
    const r = { id: uuid(), code: code(), host_user_id: u, status: "lobby", max_players: 2, cap: 150, mode: "one_loser", game_type: "war", war_cfg: { clash: cl, fool: a.p_cfg.fool === 0 ? 0 : 1 }, expires_at: new Date(Date.now() + 7200e3).toISOString() };
    T.rooms.push(r); T.room_players.push({ id: uuid(), room_id: r.id, user_id: u, seat: 1, player_name: a.p_name, avatar: a.p_avatar || "", is_host: true, is_ready: false, joined_at: Date.now(), left_at: null });
    return { room_id: r.id, code: r.code };
  },
  nn_join_room(a, u) {
    const r = T.rooms.find(x => x.code === String(a.p_code || "").toUpperCase()); if (!r || r.status !== "lobby") err("room_not_found");
    if (T.room_players.some(p => p.room_id === r.id && p.user_id === u && !p.left_at)) return { room_id: r.id, code: r.code };
    const ps = activeP(r.id); if (ps.length >= r.max_players) err("room_full");
    let seat = 1; while (ps.some(p => p.seat === seat)) seat++;
    T.room_players.push({ id: uuid(), room_id: r.id, user_id: u, seat, player_name: a.p_name, avatar: a.p_avatar || "", is_host: false, is_ready: false, joined_at: Date.now(), left_at: null });
    return { room_id: r.id, code: r.code };
  },
  war_update_settings(a, u) { const r = T.rooms.find(x => x.id === a.p_room); if (r.host_user_id !== u) err("not_host"); if (r.status !== "lobby") err("room_started"); r.war_cfg = { clash: a.p_cfg.clash, fool: a.p_cfg.fool ? 1 : 0 }; activeP(r.id).forEach(p => { p.is_ready = false }); return null },
  nn_set_ready(a, u) { const p = T.room_players.find(x => x.room_id === a.p_room && x.user_id === u && !x.left_at); if (!p) err("not_in_room"); p.is_ready = !!a.p_ready; return null },
  nn_my_room(a, u) { const p = T.room_players.find(x => x.user_id === u && !x.left_at && ["lobby", "playing"].includes((T.rooms.find(r => r.id === x.room_id) || {}).status)); const r = p && T.rooms.find(x => x.id === p.room_id); return r ? { room_id: r.id, code: r.code, status: r.status } : null },
  nn_heartbeat(a, u) { const h = T.player_heartbeats.find(x => x.room_id === a.p_room && x.user_id === u); if (h) h.last_seen_at = new Date().toISOString(); else T.player_heartbeats.push({ room_id: a.p_room, user_id: u, last_seen_at: new Date().toISOString() }); return { now_ms: Date.now() } },
  nn_rematch(a, u) { const r = T.rooms.find(x => x.id === a.p_room); if (r.host_user_id !== u) err("not_host"); if (r.status !== "finished") err("room_not_finished"); r.status = "lobby"; activeP(r.id).forEach(p => { p.is_ready = false }); return null },
  nn_leave_room(a, u) {
    const p = T.room_players.find(x => x.room_id === a.p_room && x.user_id === u && !x.left_at); if (!p) err("not_in_room"); p.left_at = new Date().toISOString(); p.is_ready = false; p.is_host = false;
    const r = T.rooms.find(x => x.id === a.p_room), rest = activeP(r.id); if (!rest.length) r.status = "closed"; else if (r.host_user_id === u) { r.host_user_id = rest[0].user_id; rest[0].is_host = true } return null
  },
  nn_close_room(a, u) { const r = T.rooms.find(x => x.id === a.p_room); if (r.host_user_id !== u) err("not_host"); r.status = "closed"; return null },
  war_commit_start(a) {
    const r = T.rooms.find(x => x.id === a.p_room); if (!r || r.game_type !== "war") return { error: "wrong_game" }; if (r.host_user_id !== a.p_host) return { error: "not_host" }; if (r.status !== "lobby") return { error: "room_started" };
    if (JSON.stringify(a.p_public.cfg) !== JSON.stringify(r.war_cfg)) return { error: "stale" };
    const ps = activeP(r.id); if (ps.length !== 2) return { error: "bad_player_count" }; if (ps.some(p => !p.is_ready)) return { error: "not_all_ready" };
    const keys = Object.keys(a.p_hands); if (keys.length !== 2 || !ps.every(p => keys.includes(p.user_id))) return { error: "stale" };
    const gid = uuid(), rno = T.games.filter(g => g.room_id === r.id).length + 1;
    T.games.push(clone({ id: gid, room_id: r.id, round_no: rno, status: "playing", version: 0, public_state: a.p_public, cur_p: -1, turn_deadline_at: a.p_deadline, updated_at: new Date().toISOString() }));
    T.game_secrets.push(clone({ game_id: gid, deck: a.p_secret.deck, disc: a.p_secret.rest, pend: Array.isArray(a.p_secret.pend) ? a.p_secret.pend : null }));
    ps.forEach(p => T.player_private_states.push(clone({ game_id: gid, user_id: p.user_id, seat: p.seat, hand: a.p_hands[p.user_id] })));
    r.status = "playing"; return { game_id: gid, round: rno };
  },
  war_commit(a) {
    const g = T.games.find(x => x.id === a.p_game); if (!g) return { error: "game_not_found" };
    if (T.game_actions.some(x => x.game_id === g.id && x.request_id === a.p_request)) return { ok: true, dup: true, version: g.version };
    if (g.status !== "playing") return { error: "game_over" }; if (g.version !== a.p_expected) return { error: "stale", version: g.version };
    g.version++; g.public_state = clone(a.p_public); g.turn_deadline_at = a.p_over !== -1 ? null : a.p_deadline; g.updated_at = new Date().toISOString();
    if (a.p_over !== -1) { g.status = "finished"; g.loser_p = a.p_over >= 0 ? a.p_over : null; T.rooms.find(x => x.id === g.room_id).status = "finished" }
    const s = T.game_secrets.find(x => x.game_id === g.id); s.deck = clone(a.p_secret.deck); s.disc = clone(a.p_secret.rest); s.pend = Array.isArray(a.p_secret.pend) ? clone(a.p_secret.pend) : null;
    Object.keys(a.p_hands).forEach(k => { T.player_private_states.find(x => x.game_id === g.id && x.user_id === k).hand = clone(a.p_hands[k]) });
    T.game_actions.push({ game_id: g.id, seq: g.version, user_id: a.p_user, request_id: a.p_request }); return { ok: true, version: g.version };
  }
};
const admin = { from: builder, rpc: (n, a) => Promise.resolve({ data: clone(RPC[n](clone(a))), error: null }) };
const api = Api.create({ admin, rnd: Math.random });
const CLIENT_TABLES = ["rooms", "room_players", "games", "player_private_states"];   // เลียน RLS: client อ่านได้เฉพาะตารางเหล่านี้ และมือของคนอื่นอ่านไม่ได้
function body(req) { return new Promise(r => { let s = ""; req.on("data", c => s += c); req.on("end", () => r(s ? JSON.parse(s) : {})) }) }
http.createServer(async (req, res) => {
  const H = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Content-Type": "application/json" };
  if (req.method === "OPTIONS") { res.writeHead(204, H); return res.end() }
  const u = req.headers["x-user"], url = req.url;
  try {
    if (url === "/v") { res.writeHead(200, H); return res.end(JSON.stringify({ v: VER })) }
    if (url === "/dump") { res.writeHead(200, H); return res.end(JSON.stringify(T)) }
    const b = await body(req);
    if (url === "/fn") { const out = await api.handle(u, b); VER++; res.writeHead(200, H); return res.end(JSON.stringify(out)) }
    if (url.startsWith("/rpc/")) {
      const fn = url.slice(5); if (!RPC[fn]) { res.writeHead(200, H); return res.end(JSON.stringify({ error: { message: "unknown " + fn } })) }
      try { const d = RPC[fn](b, u); VER++; res.writeHead(200, H); return res.end(JSON.stringify({ data: d })) } catch (e) { if (!e.expected) throw e; res.writeHead(200, H); return res.end(JSON.stringify({ error: { message: e.message } })) }
    }
    if (url === "/q") {
      if (!CLIENT_TABLES.includes(b.table)) { res.writeHead(200, H); return res.end(JSON.stringify({ error: { message: "permission denied for table " + b.table } })) }
      let rows = T[b.table].filter(r => (b.f || []).every(([k, v, nl]) => nl ? (r[k] == null) : r[k] === v));
      if (b.table === "player_private_states") rows = rows.filter(r => r.user_id === u);
      if (b.ord) rows = rows.slice().sort((x, y) => b.ord[1] ? x[b.ord[0]] - y[b.ord[0]] : y[b.ord[0]] - x[b.ord[0]]);
      if (b.lim != null) rows = rows.slice(0, b.lim);
      res.writeHead(200, H); return res.end(JSON.stringify({ data: clone(rows) }));
    }
    res.writeHead(404, H); res.end("{}");
  } catch (e) { console.error("server error", e); res.writeHead(500, H); res.end(JSON.stringify({ error: { message: String(e.message) } })) }
}).listen(+process.argv[2] || 8770, () => console.log("two-ctx server ready"));
