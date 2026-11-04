// ตัวจำลอง Supabase สำหรับทดสอบ UI แบบ end-to-end ในเบราว์เซอร์: ใช้ "ตรรกะเซิร์ฟเวอร์ตัวจริง" (NNApi/NNServer/NNEngine)
// กับฐานข้อมูลจำลองในหน่วยความจำ + บอท 2 ตัวที่เล่นแทนเพื่อน (ใช้เฉพาะในเทสต์นี้ ไม่ใช่ฟีเจอร์ของแอป)
(function () {
  var T = { rooms: [], room_players: [], games: [], game_secrets: [], player_private_states: [], game_actions: [], player_heartbeats: [] };
  var ME = "11111111-1111-4111-8111-111111111111", BOTS = ["22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"];
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
      _run: function () {
        var r = T[name].filter(function (x) { return filters.every(function (f) { return f(x); }); });
        if (ord) r = r.slice().sort(function (a, c) { return desc ? c[ord] - a[ord] : a[ord] - c[ord]; });
        if (lim != null) r = r.slice(0, lim);
        return clone(r);
      },
      maybeSingle: function () { return Promise.resolve({ data: b._run()[0] || null, error: null }); },
      then: function (res, rej) { return Promise.resolve({ data: b._run(), error: null }).then(res, rej); }
    };
    return b;
  }

  var rpcs = {
    nn_commit_start: function (a) {
      var r = T.rooms.find(function (x) { return x.id === a.p_room; });
      if (!r || r.host_user_id !== a.p_host || r.status !== "lobby") return { error: "room_started" };
      var ps = T.room_players.filter(function (p) { return p.room_id === r.id && !p.left_at; });
      if (ps.some(function (p) { return !p.is_ready; })) return { error: "not_all_ready" };
      var gid = uuid(), rno = T.games.filter(function (g) { return g.room_id === r.id; }).length + 1;
      T.games.push(clone({ id: gid, room_id: r.id, round_no: rno, status: "playing", version: 0, public_state: a.p_public, cur_p: a.p_cur, turn_deadline_at: a.p_deadline }));
      T.game_secrets.push(clone({ game_id: gid, deck: a.p_secret.deck, disc: a.p_secret.disc }));
      ps.forEach(function (p) { T.player_private_states.push(clone({ game_id: gid, user_id: p.user_id, seat: p.seat, hand: a.p_hands[p.user_id], pending: null })); });
      r.status = "playing"; return { game_id: gid, round: rno };
    },
    nn_commit_action: function (a) {
      var g = T.games.find(function (x) { return x.id === a.p_game; });
      if (T.game_actions.some(function (x) { return x.game_id === g.id && x.request_id === a.p_request; })) return { ok: true, dup: true, version: g.version };
      if (g.status !== "playing") return { error: "game_over" };
      if (g.version !== a.p_expected) return { error: "stale", version: g.version };
      g.version++; g.public_state = clone(a.p_public); g.cur_p = a.p_cur; g.turn_deadline_at = a.p_deadline;
      if (a.p_over >= 0) { g.status = "finished"; g.loser_p = a.p_over; T.rooms.find(function (x) { return x.id === g.room_id; }).status = "finished"; }
      var s = T.game_secrets.find(function (x) { return x.game_id === g.id; }); s.deck = clone(a.p_secret.deck); s.disc = clone(a.p_secret.disc);
      Object.keys(a.p_hands).forEach(function (u) { var row = T.player_private_states.find(function (x) { return x.game_id === g.id && x.user_id === u; }); var value = a.p_hands[u]; row.hand = clone(Array.isArray(value) ? value : value.hand); row.pending = clone(Array.isArray(value) ? null : (value.pending || null)); });
      T.game_actions.push({ game_id: g.id, seq: g.version, user_id: a.p_user, request_id: a.p_request });
      return { ok: true, version: g.version };
    },
    nn_create_room: function (a) {
      var r = { id: uuid(), code: "ABC234", host_user_id: ME, status: "lobby", max_players: 4, cap: a.p_cap, mode: a.p_mode };
      T.rooms.push(r);
      T.room_players.push({ id: uuid(), room_id: r.id, user_id: ME, seat: 1, player_name: a.p_name, avatar: a.p_avatar, is_host: true, is_ready: false, left_at: null });
      BOTS.slice(0, window.__BOT_COUNT == null ? 2 : window.__BOT_COUNT).forEach(function (u, i) { T.room_players.push({ id: uuid(), room_id: r.id, user_id: u, seat: i + 2, player_name: ["บอทเอ", "บอทบี"][i], avatar: "", is_host: false, is_ready: true, left_at: null }); });
      return { room_id: r.id, code: r.code };
    },
    nn_my_room: function () { var p = T.room_players.find(function (x) { return x.user_id === ME && !x.left_at; }); var r = p && T.rooms.find(function (x) { return x.id === p.room_id; }); return r ? { room_id: r.id, code: r.code, status: r.status } : null; },
    nn_set_ready: function (a) { T.room_players.find(function (x) { return x.user_id === ME && !x.left_at; }).is_ready = a.p_ready; return null; },
    nn_update_settings: function (a) { var r = T.rooms[0]; r.cap = a.p_cap; r.mode = a.p_mode; return null; },
    nn_rematch: function () { var r = T.rooms[0]; r.status = "lobby"; T.room_players.forEach(function (p) { p.is_ready = BOTS.indexOf(p.user_id) >= 0; }); return null; },
    nn_leave_room: function () { T.room_players.find(function (x) { return x.user_id === ME; }).left_at = "x"; T.rooms[0].status = "closed"; return null; },
    nn_heartbeat: function () { return { now_ms: Date.now() }; },
    nn_close_room: function () { T.rooms[0].status = "closed"; return null; }
  };

  function rnd() { var b = new Uint32Array(2); crypto.getRandomValues(b); return (b[0] * 2097152 + (b[1] >>> 11)) / 9007199254740992; }
  var admin = { from: builder, rpc: function (n, a) { return Promise.resolve({ data: clone(rpcs[n](clone(a))), error: null }); } };
  var api = NNApi.create({ admin: admin, rnd: rnd });

  // บอทเล่นแทนเพื่อน: รองรับ Star/Fool/Emperor/Moon และสถานะเลือก Sun/Chariot ด้วย
  function botChoice(card, pub) {
    var c = {};
    if (card.n === 17) c.value = Math.random() < .5 ? -17 : 17;
    if (card.n === 0) c.target = Math.floor(Math.random() * pub.np);
    if (card.n === 4 || card.n === 18) { var a = []; for (var i = 0; i < pub.np; i++) if (i !== pub.cur) a.push(i); c.target = a[Math.floor(Math.random() * a.length)]; }
    return c;
  }
  setInterval(function () {
    var g = T.games.filter(function (x) { return x.status === "playing"; })[0]; if (!g) return;
    var pub = g.public_state, actor = pub.pending ? pub.pending.p : pub.cur;
    var pl = pub.players[actor], row = T.player_private_states.find(function (x) { return x.game_id === g.id && x.seat === pl.seat; });
    if (!row || BOTS.indexOf(row.user_id) < 0) return;
    var body = { game_id: g.id, request_id: uuid(), expected_version: g.version };
    if (pub.pending && pub.pending.type === "sun") { body.action = "choose"; body.index = Math.floor(Math.random() * ((row.pending && row.pending.sunOptions || []).length || 1)); }
    else if (pub.pending && pub.pending.type === "chariot") body.action = "skip";
    else {
      var hand = row.hand.slice();
      if (pub.force === pub.cur) { var mx = Math.max.apply(null, hand.map(function (c) { return c.n; })); hand = hand.filter(function (c) { return c.n === mx; }); }
      if (!hand.length) return;
      var c = hand[Math.floor(Math.random() * hand.length)];
      body.action = "play"; body.card_id = c.id; body.choice = botChoice(c, pub);
    }
    api.handle(row.user_id, body).then(fire);
  }, 350);
  window.__forceCardTurn = function (cardN) {
    var g = T.games.filter(function (x) { return x.status === "playing"; })[0]; if (!g) return false;
    var me = T.player_private_states.find(function (x) { return x.user_id === ME && x.game_id === g.id; }); if (!me) return false;
    var p = g.public_state.players.find(function (x) { return x.seat === me.seat; }).p;
    var id = 100000 + Number(cardN) * 10;
    g.public_state.cur = p; g.cur_p = p; g.public_state.pending = null; g.public_state.phase = "await_play";
    g.public_state.turnState = { p: p, kind: "normal", played: 0, need: 1, sunChosen: false, postDraw: [] };
    g.public_state.force = -1; g.public_state.sealed[p] = false; g.public_state.total = 50; g.public_state.prev = 50;
    g.public_state.heatAt = 1000000; g.public_state.handCounts[p] = 3;
    me.hand = [{ n: Number(cardN), id: id }, { n: 1, id: id + 1 }, { n: 2, id: id + 2 }];
    g.turn_deadline_at = new Date(Date.now() + 60000).toISOString(); g.version++; fire(); return true;
  };
  window.__forceStarTurn = function (value) {
    var g = T.games.filter(function (x) { return x.status === "playing"; })[0]; if (!g) return false;
    var me = T.player_private_states.find(function (x) { return x.user_id === ME && x.game_id === g.id; }); if (!me) return false;
    var p = g.public_state.players.find(function (x) { return x.seat === me.seat; }).p;
    g.public_state.cur = p; g.cur_p = p; g.public_state.pending = null; g.public_state.phase = "await_play";
    g.public_state.turnState = { p: p, kind: "normal", played: 0, need: 1, sunChosen: false, postDraw: [] };
    g.public_state.total = 100; g.public_state.prev = 100; g.public_state.force = -1; g.turn_deadline_at = new Date(Date.now() + 60000).toISOString();
    me.hand = [{ n: 17, id: 17017 }, { n: 1, id: 17001 }, { n: 2, id: 17002 }];
    g.public_state.handCounts[p] = 3; g.version++; fire(); return true;
  };

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
      auth: {
        getSession: function () { return Promise.resolve({ data: { session: ses } }); },
        signInAnonymously: function () { ses = { access_token: "t", user: { id: ME } }; return Promise.resolve({ data: { session: ses }, error: null }); }
      },
      realtime: { setAuth: function () {} },
      rpc: function (fn, a) { if (!rpcs[fn]) return Promise.resolve({ error: { message: "unknown " + fn } }); fire(); return Promise.resolve({ data: clone(rpcs[fn](clone(a))), error: null }); },
      from: builder,
      channel: function () { var ch = { state: "joined", on: function (t, f, cb) { if (t === "postgres_changes") listeners.push(cb); return ch; }, subscribe: function (cb) { setTimeout(function () { cb("SUBSCRIBED"); }, 0); return ch; }, track: function () {}, presenceState: function () { return {}; } }; return ch; },
      removeChannel: function () {}
    };
  } };
  window.__T = T;
})();
