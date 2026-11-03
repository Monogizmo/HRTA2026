// รัน: node tests/api.test.js   — ทดสอบแกน Edge Function กับ "ฐานข้อมูลจำลอง" ที่ทำงานเหมือนฟังก์ชัน SQL nn_commit_*
// (ไม่ได้ทดสอบ SQL จริง — SQL ต้องทดสอบบน Supabase; ที่นี่ทดสอบ logic การโหลดข้อมูล/แมปผู้เล่น/ลงไพ่/กันซ้ำ/กันชน)
const assert = require("assert"), crypto = require("crypto");
const Api = require("../online/nn-api-core.js");

function prng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const uuid = () => crypto.randomUUID();
const clone = x => JSON.parse(JSON.stringify(x));

function makeDb() {
  const CLOCK = { t: Date.parse("2026-11-02T10:00:00Z") };
  const T = { rooms: [], room_players: [], games: [], game_secrets: [], player_private_states: [], game_actions: [], player_heartbeats: [] };
  function builder(name) {
    let rows = T[name], filters = [], ord = null;
    const b = {
      select() { return b; },
      eq(k, v) { filters.push(r => r[k] === v); return b; },
      is(k, v) { filters.push(r => (v === null ? r[k] == null : r[k] === v)); return b; },
      order(k) { ord = k; return b; },
      _run() { let r = rows.filter(x => filters.every(f => f(x))); if (ord) r = r.slice().sort((a, c) => a[ord] - c[ord]); return clone(r); },
      maybeSingle() { return Promise.resolve({ data: b._run()[0] || null, error: null }); },
      then(res, rej) { return Promise.resolve({ data: b._run(), error: null }).then(res, rej); }
    };
    return b;
  }
  // จำลอง nn_commit_start / nn_commit_action (ไม่มี await ภายใน = atomic เหมือน transaction + row lock)
  const rpcs = {
    nn_commit_start(a) {
      const r = T.rooms.find(x => x.id === a.p_room);
      if (!r) return { error: "room_not_found" };
      if (r.host_user_id !== a.p_host) return { error: "not_host" };
      if (r.status !== "lobby") return { error: "room_started" };
      if (r.mode !== "one_loser") return { error: "mode_not_ready" };
      if (a.p_public.cap !== r.cap) return { error: "stale" };
      const ps = T.room_players.filter(p => p.room_id === r.id && !p.left_at);
      if (ps.length < 2 || ps.length > 4) return { error: "bad_player_count" };
      if (ps.some(p => !p.is_ready)) return { error: "not_all_ready" };
      const keys = Object.keys(a.p_hands);
      if (keys.length !== ps.length || !ps.every(p => keys.includes(p.user_id))) return { error: "stale" };
      const gid = uuid(), rno = T.games.filter(g => g.room_id === r.id).length + 1;
      T.games.push(clone({ id: gid, room_id: r.id, round_no: rno, status: "playing", version: 0, public_state: a.p_public, cur_p: a.p_cur, turn_deadline_at: a.p_deadline, updated_at: new Date().toISOString() }));
      T.game_secrets.push(clone({ game_id: gid, deck: a.p_secret.deck, disc: a.p_secret.disc }));
      ps.forEach(p => T.player_private_states.push(clone({ game_id: gid, user_id: p.user_id, seat: p.seat, hand: a.p_hands[p.user_id] })));
      r.status = "playing";
      return { game_id: gid, round: rno };
    },
    nn_commit_action(a) {
      const g = T.games.find(x => x.id === a.p_game);
      if (!g) return { error: "game_not_found" };
      if (T.game_actions.some(x => x.game_id === g.id && x.request_id === a.p_request)) return { ok: true, dup: true, version: g.version };
      if (g.status !== "playing") return { error: "game_over" };
      if (g.version !== a.p_expected) return { error: "stale", version: g.version };
      g.version++; g.public_state = clone(a.p_public); g.cur_p = a.p_cur; g.turn_deadline_at = a.p_deadline; g.updated_at = new Date(CLOCK.t).toISOString();
      if (a.p_over >= 0) { g.status = "finished"; g.loser_p = a.p_over; T.rooms.find(x => x.id === g.room_id).status = "finished"; }
      const s = T.game_secrets.find(x => x.game_id === g.id); s.deck = clone(a.p_secret.deck); s.disc = clone(a.p_secret.disc);
      Object.keys(a.p_hands).forEach(u => { T.player_private_states.find(x => x.game_id === g.id && x.user_id === u).hand = clone(a.p_hands[u]); });
      T.game_actions.push({ game_id: g.id, seq: g.version, user_id: a.p_user, request_id: a.p_request });
      return { ok: true, version: g.version };
    }
  };
  const admin = { from: builder, rpc: (n, a) => Promise.resolve({ data: clone(rpcs[n](clone(a))), error: null }) };
  return { T, admin, CLOCK };
}

function setup(n, cap = 150, mode = "one_loser", ready = true) {
  const { T, admin, CLOCK } = makeDb();
  const rid = uuid(), users = Array.from({ length: n }, () => uuid());
  T.rooms.push({ id: rid, host_user_id: users[0], status: "lobby", cap, mode });
  users.forEach((u, i) => T.room_players.push({ room_id: rid, user_id: u, seat: i + 1, player_name: "P" + i, avatar: "", is_ready: ready, left_at: null }));
  const rnd = prng(12345);
  const api = Api.create({ admin, rnd, now: () => CLOCK.t });
  return { T, rid, users, api, rnd, CLOCK };
}

(async () => {
  // --- start: สิทธิ์/เงื่อนไข ---
  { const s = setup(3);
    assert.strictEqual((await s.api.handle(s.users[1], { action: "start", room_id: s.rid })).error, "not_host");
    assert.strictEqual((await s.api.handle(s.users[0], { action: "start", room_id: "nope" })).error, "bad_request");
    assert.strictEqual((await s.api.handle(null, { action: "start", room_id: s.rid })).error, "bad_request");
    s.T.room_players[1].is_ready = false;
    assert.strictEqual((await s.api.handle(s.users[0], { action: "start", room_id: s.rid })).error, "not_all_ready");
    s.T.room_players[1].is_ready = true;
    const ok = await s.api.handle(s.users[0], { action: "start", room_id: s.rid });
    assert.ok(ok.ok && ok.game_id, JSON.stringify(ok));
    assert.strictEqual(s.T.rooms[0].status, "playing");
    assert.strictEqual(s.T.player_private_states.length, 3);
    assert.ok(s.T.player_private_states.every(x => x.hand.length === 3));
    assert.strictEqual((await s.api.handle(s.users[0], { action: "start", room_id: s.rid })).error, "room_started");
    console.log("ok  start: host-only, all-ready, deals 3 cards each, double-start rejected"); }
  { const s = setup(2, 150, "elimination");
    assert.strictEqual((await s.api.handle(s.users[0], { action: "start", room_id: s.rid })).error, "mode_not_ready");
    const one = setup(1); assert.strictEqual((await one.api.handle(one.users[0], { action: "start", room_id: one.rid })).error, "bad_player_count");
    console.log("ok  start: elimination mode & 1 player rejected"); }

  // --- play: ความถูกต้อง/กันซ้ำ/กันชน ---
  { const s = setup(3);
    const st = await s.api.handle(s.users[0], { action: "start", room_id: s.rid });
    const gid = st.game_id, game = () => s.T.games[0];
    const uidOfP = p => s.T.player_private_states.find(x => x.seat === game().public_state.players[p].seat).user_id;
    const handOf = u => s.T.player_private_states.find(x => x.user_id === u).hand;
    const cur = game().public_state.cur, curU = uidOfP(cur), otherU = uidOfP((cur + 1) % 3);
    const card = handOf(curU)[0].id, req = uuid();
    assert.strictEqual((await s.api.handle(otherU, { action: "play", game_id: gid, card_id: handOf(otherU)[0].id, request_id: uuid(), expected_version: 0 })).error, "not_your_turn");
    assert.strictEqual((await s.api.handle(uuid(), { action: "play", game_id: gid, card_id: card, request_id: uuid(), expected_version: 0 })).error, "not_in_game");
    assert.strictEqual((await s.api.handle(curU, { action: "play", game_id: gid, card_id: card, request_id: uuid(), expected_version: 7 })).error, "stale");
    assert.strictEqual((await s.api.handle(curU, { action: "play", game_id: gid, card_id: "x", request_id: uuid(), expected_version: 0 })).error, "bad_request");
    const r1 = await s.api.handle(curU, { action: "play", game_id: gid, card_id: card, request_id: req, expected_version: 0 });
    assert.ok(r1.ok && r1.version === 1, JSON.stringify(r1));
    const afterOnce = JSON.stringify([game().public_state, s.T.player_private_states, s.T.game_secrets]);
    // ส่งซ้ำ request_id เดิม (เช่น กดซ้ำ/เน็ตส่งซ้ำ) → ไม่ลงไพ่ซ้ำ
    const r2 = await s.api.handle(curU, { action: "play", game_id: gid, card_id: card, request_id: req, expected_version: 0 });
    assert.ok(r2.ok && r2.dup, JSON.stringify(r2));
    assert.strictEqual(JSON.stringify([game().public_state, s.T.player_private_states, s.T.game_secrets]), afterOnce);
    assert.strictEqual(s.T.game_actions.length, 1);
    console.log("ok  play: turn/membership/stale/validation checks, duplicate request_id is idempotent"); }

  // --- ชนกัน: สองคำขอพร้อมกันด้วย version เดียวกัน → สำเร็จได้ 1 ---
  { const s = setup(2);
    const st = await s.api.handle(s.users[0], { action: "start", room_id: s.rid });
    const g = s.T.games[0], cur = g.public_state.cur;
    const u = s.T.player_private_states.find(x => x.seat === g.public_state.players[cur].seat);
    const [a, b] = await Promise.all([
      s.api.handle(u.user_id, { action: "play", game_id: st.game_id, card_id: u.hand[0].id, request_id: uuid(), expected_version: 0 }),
      s.api.handle(u.user_id, { action: "play", game_id: st.game_id, card_id: u.hand[1].id, request_id: uuid(), expected_version: 0 })]);
    const oks = [a, b].filter(x => x.ok).length;
    assert.strictEqual(oks, 1, JSON.stringify([a, b]));
    assert.strictEqual([a, b].find(x => !x.ok).error === "stale" || [a, b].find(x => !x.ok).error === "not_your_turn", true);
    assert.strictEqual(s.T.games[0].version, 1);
    console.log("ok  concurrency: two simultaneous plays on the same version -> exactly one applied"); }

  // --- Phase 3: timeout / หลุด / ยอมแพ้ ---
  { const s = setup(3);
    const st = await s.api.handle(s.users[0], { action: "start", room_id: s.rid });
    const gid = st.game_id, g = () => s.T.games[0];
    const uidOfP = p => s.T.player_private_states.find(x => x.seat === g().public_state.players[p].seat).user_id;
    const hb = (u, ageMs) => { const r = s.T.player_heartbeats.find(x => x.user_id === u); const iso = new Date(s.CLOCK.t - ageMs).toISOString(); if (r) r.last_seen_at = iso; else s.T.player_heartbeats.push({ room_id: s.rid, user_id: u, last_seen_at: iso }); };
    const cur = g().public_state.cur, curU = uidOfP(cur), other = uidOfP((cur + 1) % 3);
    s.T.games[0].turn_deadline_at = new Date(s.CLOCK.t + 60000).toISOString();     // ตาละ 60 วิ
    s.users.forEach(u => hb(u, 1000));
    // ยังไม่หมดเวลา: เรียก check เร็วไปไม่มีผล
    let r = await s.api.handle(other, { action: "check", game_id: gid });
    assert.strictEqual(r.state, "waiting"); assert.strictEqual(g().status, "playing");
    assert.strictEqual((await s.api.handle(uuid(), { action: "check", game_id: gid })).error, "not_in_game");
    // หมดเวลาตา 61 วิ + ผู้เล่นยังออนไลน์ → ยอมแพ้ (timeout)
    s.CLOCK.t += 61000; hb(curU, 5000);
    r = await s.api.handle(other, { action: "check", game_id: gid });
    assert.strictEqual(r.state, "forfeited"); assert.strictEqual(r.reason, "timeout"); assert.strictEqual(r.loser, cur);
    assert.strictEqual(g().status, "finished"); assert.strictEqual(g().loser_p, cur); assert.strictEqual(s.T.rooms[0].status, "finished");
    assert.strictEqual(g().public_state.last.forfeit, true);
    assert.strictEqual((await s.api.handle(curU, { action: "play", game_id: gid, card_id: 1, request_id: uuid(), expected_version: g().version })).error, "game_over");
    assert.strictEqual((await s.api.handle(other, { action: "check", game_id: gid })).state, "over");
    console.log("ok  timeout: early check ignored; 61s idle while connected -> forfeit(timeout), room finished"); }

  { const s = setup(2);
    const st = await s.api.handle(s.users[0], { action: "start", room_id: s.rid });
    const gid = st.game_id, g = () => s.T.games[0];
    const uidOfP = p => s.T.player_private_states.find(x => x.seat === g().public_state.players[p].seat).user_id;
    const cur = g().public_state.cur, curU = uidOfP(cur), other = uidOfP(1 - cur);
    const T0 = s.CLOCK.t; s.T.games[0].turn_deadline_at = new Date(T0 + 60000).toISOString();
    s.T.player_heartbeats.push({ room_id: s.rid, user_id: other, last_seen_at: new Date(T0).toISOString() });
    s.T.player_heartbeats.push({ room_id: s.rid, user_id: curU, last_seen_at: new Date(T0 - 10000).toISOString() }); // เห็นล่าสุด 10 วิก่อน
    s.CLOCK.t = T0 + 70000;                       // ตาเกิน 60 วิ และคนนี้หายไป 80 วิ (ยังไม่ครบ 120)
    s.T.player_heartbeats.find(x => x.user_id === other).last_seen_at = new Date(s.CLOCK.t).toISOString();
    let r = await s.api.handle(other, { action: "check", game_id: gid });
    assert.strictEqual(r.state, "waiting"); assert.strictEqual(r.connected, false); assert.ok(r.remaining_ms > 0 && r.remaining_ms <= 50000, JSON.stringify(r));
    s.CLOCK.t = T0 - 10000 + 121000;              // หายครบ 120 วิ
    s.T.player_heartbeats.find(x => x.user_id === other).last_seen_at = new Date(s.CLOCK.t).toISOString();
    r = await s.api.handle(other, { action: "check", game_id: gid });
    assert.strictEqual(r.state, "forfeited"); assert.strictEqual(r.reason, "disconnected"); assert.strictEqual(g().loser_p, cur);
    console.log("ok  disconnect: waits through 120s reconnect window, then forfeit(disconnected)"); }

  { const s = setup(4);
    const st = await s.api.handle(s.users[0], { action: "start", room_id: s.rid });
    const gid = st.game_id, g = () => s.T.games[0];
    // ออกกลางเกม (ไม่ใช่ตาตัวเอง) = ยอมแพ้ ; เรียกซ้ำพร้อมกันได้ผลครั้งเดียว
    const leaver = s.users[2], pOf = s.T.player_private_states.find(x => x.user_id === leaver).seat - 1;
    const rs = await Promise.all([1, 2, 3].map(() => s.api.handle(leaver, { action: "forfeit", game_id: gid })));
    assert.strictEqual(rs.filter(x => x.state === "forfeited").length, 1, JSON.stringify(rs));
    assert.ok(rs.every(x => x.ok));
    assert.strictEqual(g().version, 1); assert.strictEqual(g().loser_p, g().public_state.players.findIndex(pl => pl.seat === pOf + 1));
    assert.strictEqual(g().public_state.last.reason, "left");
    assert.strictEqual((await s.api.handle(uuid(), { action: "forfeit", game_id: gid })).error, "not_in_game");
    console.log("ok  forfeit: leaving mid-game = loss, concurrent calls apply exactly once"); }

  { // เช็กพร้อมกัน 3 เครื่องหลังหมดเวลา → ตัดสินครั้งเดียว
    const s = setup(3);
    const st = await s.api.handle(s.users[0], { action: "start", room_id: s.rid });
    s.T.games[0].turn_deadline_at = new Date(s.CLOCK.t - 1000).toISOString();
    s.T.player_heartbeats.push(...s.users.map(u => ({ room_id: s.rid, user_id: u, last_seen_at: new Date(s.CLOCK.t).toISOString() })));
    const rs = await Promise.all(s.users.map(u => s.api.handle(u, { action: "check", game_id: st.game_id })));
    assert.strictEqual(rs.filter(x => x.state === "forfeited").length, 1, JSON.stringify(rs));
    assert.strictEqual(s.T.games[0].version, 1);
    console.log("ok  concurrent check: 3 clients, timeout applied exactly once"); }

  // --- เล่นจนจบเกมผ่าน API (2,3,4 คน หลายเกม) ---
  let finished = 0, plays = 0;
  for (const n of [2, 3, 4]) for (let k = 0; k < 25; k++) {
    const s = setup(n, [120, 150, 200][k % 3]); s.rnd = prng(k * 31 + n);
    const st = await s.api.handle(s.users[0], { action: "start", room_id: s.rid });
    const mv = prng(k * 977 + n);
    let guard = 0;
    while (s.T.games[0].status === "playing") {
      assert.ok(++guard < 3000);
      const g = s.T.games[0], cur = g.public_state.cur;
      const row = s.T.player_private_states.find(x => x.seat === g.public_state.players[cur].seat);
      // เลือกไพ่ที่ถูกกติกา (ถ้าถูกบังคับ ต้องใบสูงสุด)
      let cand = row.hand.slice();
      if (g.public_state.force === cur) { const mx = Math.max(...cand.map(c => c.n)); cand = cand.filter(c => c.n === mx); }
      const c = cand[Math.floor(mv() * cand.length)];
      const r = await s.api.handle(row.user_id, { action: "play", game_id: st.game_id, card_id: c.id, request_id: uuid(), expected_version: g.version });
      assert.ok(r.ok, JSON.stringify(r)); plays++;
    }
    const g = s.T.games[0];
    assert.strictEqual(g.status, "finished"); assert.ok(g.loser_p >= 0 && g.loser_p < n);
    assert.strictEqual(s.T.rooms[0].status, "finished");
    assert.strictEqual((await s.api.handle(s.users[0], { action: "play", game_id: st.game_id, card_id: 1, request_id: uuid(), expected_version: g.version })).error, "game_over");
    finished++;
  }
  console.log(`ok  full games via API: ${finished} games, ${plays} plays, each ends with exactly one loser and room=finished`);
  console.log("ALL PASSED");
})().catch(e => { console.error(e); process.exit(1); });
