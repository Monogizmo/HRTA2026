// ตัวจำลอง Supabase สำหรับ e2e ของสงครามไพ่ยุทธวิธีออนไลน์: ใช้ "ตรรกะเซิร์ฟเวอร์ตัวจริง" (NNApi + WarApi/WarServer/WarTactics)
// กับฐานข้อมูลจำลองในหน่วยความจำ + บอท 1 ตัวเป็นคู่ต่อสู้ (ใช้เฉพาะในเทสต์นี้ ไม่ใช่ฟีเจอร์ของแอป)
(function () {
  var T = { rooms: [], room_players: [], games: [], game_secrets: [], player_private_states: [], game_actions: [], player_heartbeats: [] };
  var ME = "11111111-1111-4111-8111-111111111111", BOT = "22222222-2222-4222-8222-222222222222";
  var listeners = [];
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function fire() { listeners.forEach(function (f) { setTimeout(function () { f({ new: null }); }, 0); }); }
  function uuid() { return crypto.randomUUID(); }
  function builder(name) {
    var filters = [], ord = null, desc = false, lim = null;
    var b = {
      select: function () { return b; },
      eq: function (k, v) { filters.push(function (r) { return r[k] === v; }); return b; },
      is: function (k, v) { filters.push(function (r) { return v === null ? r[k] == null : r[k] === v; }); return b; },
      order: function (k, o) { ord = k; desc = o && o.ascending === false; return b; },
      limit: function (n) { lim = n; return b; },
      _run: function () { var r = T[name].filter(function (x) { return filters.every(function (f) { return f(x); }); });
        if (ord) r = r.slice().sort(function (a, c) { return desc ? c[ord] - a[ord] : a[ord] - c[ord]; }); if (lim != null) r = r.slice(0, lim); return clone(r); },
      maybeSingle: function () { return Promise.resolve({ data: b._run()[0] || null, error: null }); },
      then: function (res, rej) { return Promise.resolve({ data: b._run(), error: null }).then(res, rej); }
    };
    return b;
  }
  var rpcs = {
    war_create_room: function (a) {
      var r = { id: uuid(), code: "WAR234", host_user_id: ME, status: "lobby", max_players: 2, cap: 150, mode: "one_loser", game_type: "war", war_cfg: { clash: a.p_cfg.clash, fool: a.p_cfg.fool ? 1 : 0 } };
      T.rooms.push(r);
      T.room_players.push({ id: uuid(), room_id: r.id, user_id: ME, seat: 1, player_name: a.p_name, avatar: a.p_avatar, is_host: true, is_ready: false, left_at: null });
      T.room_players.push({ id: uuid(), room_id: r.id, user_id: BOT, seat: 2, player_name: "บอทบี", avatar: "", is_host: false, is_ready: true, left_at: null });
      return { room_id: r.id, code: r.code };
    },
    war_update_settings: function (a) { var r = T.rooms[0]; r.war_cfg = { clash: a.p_cfg.clash, fool: a.p_cfg.fool ? 1 : 0 }; T.room_players.forEach(function (p) { p.is_ready = p.user_id === BOT; }); return null; },
    war_commit_start: function (a) {
      var r = T.rooms.find(function (x) { return x.id === a.p_room; });
      if (!r || r.host_user_id !== a.p_host || r.status !== "lobby") return { error: "room_started" };
      if (JSON.stringify(a.p_public.cfg) !== JSON.stringify(r.war_cfg)) return { error: "stale" };
      var ps = T.room_players.filter(function (p) { return p.room_id === r.id && !p.left_at; });
      if (ps.some(function (p) { return !p.is_ready; })) return { error: "not_all_ready" };
      var gid = uuid(), rno = T.games.filter(function (g) { return g.room_id === r.id; }).length + 1;
      T.games.push(clone({ id: gid, room_id: r.id, round_no: rno, status: "playing", version: 0, public_state: a.p_public, cur_p: -1, turn_deadline_at: a.p_deadline }));
      T.game_secrets.push(clone({ game_id: gid, deck: a.p_secret.deck, disc: a.p_secret.rest, pend: a.p_secret.pend }));
      ps.forEach(function (p) { T.player_private_states.push(clone({ game_id: gid, user_id: p.user_id, seat: p.seat, hand: a.p_hands[p.user_id] })); });
      r.status = "playing"; return { game_id: gid, round: rno };
    },
    war_commit: function (a) {
      var g = T.games.find(function (x) { return x.id === a.p_game; });
      if (T.game_actions.some(function (x) { return x.game_id === g.id && x.request_id === a.p_request; })) return { ok: true, dup: true, version: g.version };
      if (g.status !== "playing") return { error: "game_over" };
      if (g.version !== a.p_expected) return { error: "stale", version: g.version };
      g.version++; g.public_state = clone(a.p_public); g.turn_deadline_at = a.p_over !== -1 ? null : a.p_deadline;
      if (a.p_over !== -1) { g.status = "finished"; g.loser_p = a.p_over >= 0 ? a.p_over : null; T.rooms.find(function (x) { return x.id === g.room_id; }).status = "finished"; }
      var s = T.game_secrets.find(function (x) { return x.game_id === g.id; }); s.deck = clone(a.p_secret.deck); s.disc = clone(a.p_secret.rest); s.pend = a.p_secret.pend ? clone(a.p_secret.pend) : null;
      Object.keys(a.p_hands).forEach(function (u) { T.player_private_states.find(function (x) { return x.game_id === g.id && x.user_id === u; }).hand = clone(a.p_hands[u]); });
      T.game_actions.push({ game_id: g.id, seq: g.version, user_id: a.p_user, request_id: a.p_request });
      return { ok: true, version: g.version };
    },
    nn_my_room: function () { var p = T.room_players.find(function (x) { return x.user_id === ME && !x.left_at; }); var r = p && T.rooms.find(function (x) { return x.id === p.room_id; }); return r ? { room_id: r.id, code: r.code, status: r.status } : null; },
    nn_set_ready: function (a) { T.room_players.find(function (x) { return x.user_id === ME && !x.left_at; }).is_ready = a.p_ready; return null; },
    nn_rematch: function () { var r = T.rooms[0]; r.status = "lobby"; T.room_players.forEach(function (p) { p.is_ready = p.user_id === BOT; }); return null; },
    nn_leave_room: function () { T.room_players.find(function (x) { return x.user_id === ME; }).left_at = "x"; T.rooms[0].status = "closed"; return null; },
    nn_heartbeat: function () { return { now_ms: Date.now() }; },
    nn_close_room: function () { T.rooms[0].status = "closed"; return null; }
  };
  function rnd() { var b = new Uint32Array(2); crypto.getRandomValues(b); return (b[0] * 2097152 + (b[1] >>> 11)) / 9007199254740992; }
  var admin = { from: builder, rpc: function (n, a) { return Promise.resolve({ data: clone(rpcs[n](clone(a))), error: null }); } };
  var api = NNApi.create({ admin: admin, rnd: rnd });

  // บอทเล่นแทนเพื่อน: ถ้ายังไม่ได้เลือกในเฟสปัจจุบัน เลือกแบบสุ่มที่ถูกกติกา (ใช้แค่มือตัวเอง + public state)
  setInterval(function () {
    var g = T.games.filter(function (x) { return x.status === "playing"; })[0]; if (!g) return;
    var pub = g.public_state, sec = T.game_secrets.find(function (x) { return x.game_id === g.id; });
    var botIdx = pub.players.findIndex(function (pl) { return pl.seat === 2; });
    if (sec.pend && sec.pend[botIdx]) return;
    if (Math.random() < .35) return;
    var hand = T.player_private_states.find(function (x) { return x.game_id === g.id && x.user_id === BOT; }).hand.slice(), ch;
    if (!hand.length) return;
    if (pub.phase === "play") { var c = hand[Math.floor(Math.random() * hand.length)]; ch = { c: c.id }; if (hand.length > 1 && pub.rz[botIdx] < 2 && Math.random() < .25) ch.x = hand.filter(function (x) { return x.id !== c.id; })[0].id; }
    else if (Math.random() < .2) ch = { r: 1 };
    else { hand.sort(function (a, b) { return a.n - b.n; }); var nd = pub.need[botIdx]; ch = { down: hand.slice(0, nd).map(function (c) { return c.id; }), up: hand[hand.length - 1].id }; }
    api.handle(BOT, { action: "war_choose", game_id: g.id, request_id: uuid(), expected_version: g.version, choice: ch }).then(fire);
  }, 400);

  var realFetch = window.fetch;
  window.fetch = function (url, opt) {
    if (String(url).indexOf("/functions/v1/nn-api") > -1) {
      var body = JSON.parse(opt.body);
      return api.handle(ME, body).then(function (out) { fire(); return new Response(JSON.stringify(out), { status: 200 }); });
    }
    return realFetch.apply(this, arguments);
  };
  var ses = null;
  window.supabase = { createClient: function () {
    return {
      auth: { getSession: function () { return Promise.resolve({ data: { session: ses } }); },
        signInAnonymously: function () { ses = { access_token: "t", user: { id: ME } }; return Promise.resolve({ data: { session: ses }, error: null }); } },
      realtime: { setAuth: function () {} },
      rpc: function (fn, a) { if (!rpcs[fn]) return Promise.resolve({ error: { message: "unknown " + fn } }); fire(); return Promise.resolve({ data: clone(rpcs[fn](clone(a))), error: null }); },
      from: builder,
      channel: function () { var ch = { state: "joined", on: function (t, f, cb) { if (t === "postgres_changes") listeners.push(cb); return ch; }, subscribe: function (cb) { setTimeout(function () { cb("SUBSCRIBED"); }, 0); return ch; }, track: function () {}, presenceState: function () { return {}; } }; return ch; },
      removeChannel: function () {}
    };
  } };
  window.__T = T;
})();
