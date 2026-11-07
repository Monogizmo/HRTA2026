// รัน: node tests/war-api.test.js — ทดสอบสงครามไพ่ยุทธวิธีออนไลน์: แกน Edge Function กับ "ฐานข้อมูลจำลอง" ที่ทำงานเหมือนฟังก์ชัน SQL war_commit_*
// (ไม่ได้ทดสอบ SQL จริง — SQL ต้องทดสอบบน Supabase; ที่นี่ทดสอบ commit–reveal, กันซ้ำ/กันชน, ข้อมูลลับ, หมดเวลา/ยอมแพ้, Rematch, ผลตรงกับ engine)
const assert = require("assert"), crypto = require("crypto");
const Api = require("../online/nn-api-core.js"), WT = require("../online/war-engine.js");
const { prng } = require("./helpers.js");
const uuid = () => crypto.randomUUID(), clone = x => JSON.parse(JSON.stringify(x));

function makeDb() {
  const CLOCK = { t: Date.parse("2026-11-02T10:00:00Z") };
  const T = { rooms: [], room_players: [], games: [], game_secrets: [], player_private_states: [], game_actions: [], player_heartbeats: [] };
  function builder(name) {
    let rows = T[name], filters = [], ord = null;
    const b = { select() { return b }, eq(k, v) { filters.push(r => r[k] === v); return b }, is(k, v) { filters.push(r => (v === null ? r[k] == null : r[k] === v)); return b },
      order(k) { ord = k; return b }, _run() { let r = rows.filter(x => filters.every(f => f(x))); if (ord) r = r.slice().sort((a, c) => a[ord] - c[ord]); return clone(r) },
      maybeSingle() { return Promise.resolve({ data: b._run()[0] || null, error: null }) }, then(res, rej) { return Promise.resolve({ data: b._run(), error: null }).then(res, rej) } };
    return b;
  }
  const rpcs = {   // เลียนแบบ war_commit_start / war_commit ใน 006_war_online.sql
    war_commit_start(a) {
      const r = T.rooms.find(x => x.id === a.p_room);
      if (!r) return { error: "room_not_found" }; if (r.game_type !== "war") return { error: "wrong_game" };
      if (r.host_user_id !== a.p_host) return { error: "not_host" }; if (r.status !== "lobby") return { error: "room_started" };
      if (JSON.stringify(a.p_public.cfg) !== JSON.stringify(r.war_cfg)) return { error: "stale" };
      const ps = T.room_players.filter(p => p.room_id === r.id && !p.left_at);
      if (ps.length !== 2) return { error: "bad_player_count" }; if (ps.some(p => !p.is_ready)) return { error: "not_all_ready" };
      const keys = Object.keys(a.p_hands); if (keys.length !== 2 || !ps.every(p => keys.includes(p.user_id))) return { error: "stale" };
      const gid = uuid(), rno = T.games.filter(g => g.room_id === r.id).length + 1;
      T.games.push(clone({ id: gid, room_id: r.id, round_no: rno, status: "playing", version: 0, public_state: a.p_public, cur_p: -1, turn_deadline_at: a.p_deadline, updated_at: new Date(CLOCK.t).toISOString() }));
      T.game_secrets.push(clone({ game_id: gid, deck: a.p_secret.deck, disc: a.p_secret.rest, pend: Array.isArray(a.p_secret.pend) ? a.p_secret.pend : null }));
      ps.forEach(p => T.player_private_states.push(clone({ game_id: gid, user_id: p.user_id, seat: p.seat, hand: a.p_hands[p.user_id] })));
      r.status = "playing"; return { game_id: gid, round: rno };
    },
    war_commit(a) {
      const g = T.games.find(x => x.id === a.p_game); if (!g) return { error: "game_not_found" };
      if (T.rooms.find(x => x.id === g.room_id).game_type !== "war") return { error: "wrong_game" };
      if (T.game_actions.some(x => x.game_id === g.id && x.request_id === a.p_request)) return { ok: true, dup: true, version: g.version };
      if (g.status !== "playing") return { error: "game_over" };
      if (g.version !== a.p_expected) return { error: "stale", version: g.version };
      g.version++; g.public_state = clone(a.p_public); g.turn_deadline_at = a.p_over !== -1 ? null : a.p_deadline; g.updated_at = new Date(CLOCK.t).toISOString();
      if (a.p_over !== -1) { g.status = "finished"; g.loser_p = a.p_over >= 0 ? a.p_over : null; T.rooms.find(x => x.id === g.room_id).status = "finished"; }
      const s = T.game_secrets.find(x => x.game_id === g.id); s.deck = clone(a.p_secret.deck); s.disc = clone(a.p_secret.rest); s.pend = Array.isArray(a.p_secret.pend) ? clone(a.p_secret.pend) : null;
      Object.keys(a.p_hands).forEach(u => { T.player_private_states.find(x => x.game_id === g.id && x.user_id === u).hand = clone(a.p_hands[u]) });
      T.game_actions.push({ game_id: g.id, seq: g.version, user_id: a.p_user, request_id: a.p_request, action_type: a.p_type, payload: { t: a.p_type } });
      return { ok: true, version: g.version };
    }
  };
  const admin = { from: builder, rpc: (n, a) => Promise.resolve({ data: clone(rpcs[n](clone(a))), error: null }) };
  return { T, admin, CLOCK };
}
function setup(cfg, seed = 12345, ready = true) {
  const { T, admin, CLOCK } = makeDb(), rid = uuid(), users = [uuid(), uuid()];
  T.rooms.push({ id: rid, host_user_id: users[0], status: "lobby", game_type: "war", war_cfg: cfg || { clash: "u", fool: 1 }, cap: 150, mode: "one_loser" });
  users.forEach((u, i) => T.room_players.push({ room_id: rid, user_id: u, seat: i + 1, player_name: "P" + i, avatar: "", is_ready: ready, left_at: null }));
  const rnd = prng(seed), api = Api.create({ admin, rnd, now: () => CLOCK.t });
  return { T, rid, users, api, rnd, CLOCK, seed };
}
const G = s => s.T.games[s.T.games.length - 1];
const hand = (s, u) => s.T.player_private_states.find(x => x.game_id === G(s).id && x.user_id === u).hand;
const secret = s => s.T.game_secrets.find(x => x.game_id === G(s).id);
const base = s => ({ game_id: G(s).id, request_id: uuid(), expected_version: G(s).version });
const choose = (s, u, choice, extra) => s.api.handle(u, Object.assign({ action: "war_choose", choice }, base(s), extra || {}));
const startGame = async s => { const r = await s.api.handle(s.users[0], { action: "war_start", room_id: s.rid }); assert.ok(r.ok, JSON.stringify(r)); return r };
// ตัวแทนผู้เล่น: เลือกไพ่ที่ถูกกติกาจากมือของตัวเอง + public state เท่านั้น
function agentChoice(s, u, mv) {
  const pub = G(s).public_state, h = hand(s, u).slice(), p = pub.players.findIndex(pl => s.T.room_players.find(r => r.user_id === u).seat === pl.seat);
  if (pub.phase === "play") { const c = h[Math.floor(mv() * h.length)], ch = { c: c.id }; if (h.length > 1 && pub.rz[p] < 2 && mv() < 0.25) ch.x = h.filter(x => x.id !== c.id)[0].id; return ch }
  if (mv() < 0.2) return { r: 1 };
  h.sort((a, b) => a.n - b.n); const nd = pub.need[p]; return { down: h.slice(0, nd).map(c => c.id), up: h[h.length - 1].id };
}
const PUB_KEYS = ["round", "phase", "depth", "over", "deckN", "handN", "pileN", "discN", "potN", "up", "cfg", "players", "cm", "rs", "ev", "rz", "need", "res"];
const total = s => { const sec = secret(s), r = sec.disc; return sec.deck.length + hand(s, s.users[0]).length + hand(s, s.users[1]).length + r.piles[0].length + r.piles[1].length + r.disc.length + r.pot.length };

(async () => {
  // --- start ---
  { const s = setup();
    assert.strictEqual((await s.api.handle(s.users[1], { action: "war_start", room_id: s.rid })).error, "not_host");
    assert.strictEqual((await s.api.handle(s.users[0], { action: "war_start", room_id: "nope" })).error, "bad_request");
    assert.strictEqual((await s.api.handle(null, { action: "war_start", room_id: s.rid })).error, "bad_request");
    s.T.room_players[1].is_ready = false; assert.strictEqual((await s.api.handle(s.users[0], { action: "war_start", room_id: s.rid })).error, "not_all_ready"); s.T.room_players[1].is_ready = true;
    await startGame(s); assert.strictEqual(s.T.rooms[0].status, "playing");
    assert.ok(s.T.player_private_states.every(x => x.hand.length === 3)); assert.strictEqual(secret(s).deck.length, 38); assert.strictEqual(total(s), 44);
    assert.strictEqual((await s.api.handle(s.users[0], { action: "war_start", room_id: s.rid })).error, "room_started");
    const nn = setup(); nn.T.rooms[0].game_type = "nn"; assert.strictEqual((await nn.api.handle(nn.users[0], { action: "war_start", room_id: nn.rid })).error, "wrong_game");
    const nn2 = setup(); nn2.T.rooms[0].game_type = "war"; nn2.T.rooms[0].host_user_id = nn2.users[0]; // และเกมเลขเพดาน (start) ต้องไม่เริ่มห้องสงครามไพ่
    assert.strictEqual((await nn2.api.handle(nn2.users[0], { action: "start", room_id: nn2.rid })).error, "wrong_game");
    const three = setup(); three.T.room_players.push({ room_id: three.rid, user_id: uuid(), seat: 3, player_name: "X", avatar: "", is_ready: true, left_at: null });
    assert.strictEqual((await three.api.handle(three.users[0], { action: "war_start", room_id: three.rid })).error, "bad_player_count");
    console.log("ok  start: host-only, ready, war-only, exactly 2 players, 3-card hands + 38-card deck, double-start rejected"); }

  // --- commit–reveal ---
  { const s = setup(); await startGame(s); const [A, B] = s.users, hA = hand(s, A), hB = hand(s, B);
    const pub0 = clone(G(s).public_state);
    assert.deepStrictEqual(Object.keys(pub0).filter(k => !PUB_KEYS.includes(k)), [], "public keys whitelist");
    const r1 = await choose(s, A, { c: hA[0].id }); assert.ok(r1.ok && !r1.resolved, JSON.stringify(r1));
    const pj = JSON.stringify(G(s).public_state);
    assert.deepStrictEqual(G(s).public_state.cm, [true, false]); assert.strictEqual(G(s).public_state.round, 0);
    assert.ok(!pj.includes('"hand"') && !pj.includes('"pend"') && !pj.includes('"deck"'), "public state leaks");
    assert.strictEqual(pj.indexOf('"c":' + hA[0].id), -1, "chosen card must not be in public state");
    assert.deepStrictEqual(secret(s).pend[0], { c: hA[0].id }); assert.strictEqual(secret(s).pend[1], null);
    assert.deepStrictEqual(hand(s, B), hB, "other hand untouched");
    // ซ้ำ/ชน
    const dupId = uuid(); const stale = await s.api.handle(B, { action: "war_choose", game_id: G(s).id, request_id: uuid(), expected_version: 0, choice: { c: hB[0].id } });
    assert.strictEqual(stale.error, "stale");
    const again = await choose(s, A, { c: hA[1].id }); assert.strictEqual(again.error, "already_chosen");
    assert.strictEqual((await choose(s, B, { c: hA[1].id })).error, "illegal", "cannot pick a card that is in the other hand");
    assert.strictEqual((await choose(s, B, { c: 9999 })).error, "illegal");
    assert.strictEqual((await choose(s, B, { r: 1 })).error, "illegal", "retreat not valid in play phase");
    assert.strictEqual((await choose(s, uuid(), { c: hB[0].id })).error, "not_in_game");
    assert.strictEqual((await s.api.handle(B, { action: "war_choose", choice: { c: 1 } })).error, "bad_request");
    const rid = uuid(), ok1 = await s.api.handle(B, { action: "war_choose", game_id: G(s).id, request_id: rid, expected_version: G(s).version, choice: { c: hB[0].id } });
    assert.ok(ok1.ok && ok1.resolved, JSON.stringify(ok1));
    const gp = G(s).public_state, flip = gp.ev.find(e => e.t === "flip");
    assert.deepStrictEqual(flip.up, [hA[0].n, hB[0].n]); assert.strictEqual(gp.rs, 1); assert.deepStrictEqual(gp.cm, [false, false]); assert.deepStrictEqual(secret(s).pend, [null, null]);
    // ส่งซ้ำคำขอเดิม (เน็ตซ้ำ) → สำเร็จแบบ dup ไม่ตัดสินซ้ำ
    const dup = await s.api.handle(B, { action: "war_choose", game_id: G(s).id, request_id: rid, expected_version: G(s).version - 1, choice: { c: hB[0].id } }); assert.ok(dup.ok && dup.dup, JSON.stringify(dup));
    assert.strictEqual(total(s), 44); assert.ok(hand(s, A).length >= 2);
    console.log("ok  commit–reveal: choice hidden until both confirm, only 'confirmed' flag public, dup/stale/illegal rejected, reveal+resolve atomic"); }

  // --- เล่นจนจบผ่าน API ทุก clash mode + ไพ่ครบ 44 + ผลตรงกับ engine ---
  for (const clash of ["u", "un", "eq"]) for (const fool of [1, 0]) {
    let wars = 0, retreats = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const s = setup({ clash, fool }, seed * 77); await startGame(s); const mv = prng(seed * 5 + 1), record = []; let n = 0;
      while (G(s).status === "playing" && n++ < 200) {
        const phase = G(s).public_state.phase, pend = secret(s).pend, need = [0, 1].filter(p => !pend[p]);
        if (phase === "war") wars++;
        const ch = {}; for (const p of need) { ch[p] = agentChoice(s, s.users[p], mv); if (ch[p].r) retreats++ }
        for (const p of need) { const r = await choose(s, s.users[p], ch[p]); assert.ok(r.ok, JSON.stringify([r, ch[p], phase])); }
        assert.strictEqual(total(s), 44, "conservation");
        const pj = JSON.stringify(G(s).public_state); assert.ok(!pj.includes('"hand"') && !pj.includes('"pend"'));
        if (need.length === 2) record.push([ch[0], ch[1]]); else record.push([secret(s).pend, null]);   // (บันทึกไว้เฉพาะ parity ด้านล่าง)
      }
      assert.strictEqual(G(s).status, "finished", "game finishes"); assert.strictEqual(s.T.rooms[0].status, "finished");
      const pub = G(s).public_state, r = pub.res; assert.ok(r && pub.over === "done", JSON.stringify(pub.over));
      assert.strictEqual(r.a + r.b <= 44, true); assert.strictEqual(G(s).loser_p, r.w === 0 ? 1 : r.w === 1 ? 0 : null);
      // parity: เล่นซ้ำบน engine ตรง ๆ ด้วย seed เดียวกัน ต้องได้ผลเดียวกันทุกตา
      const E = WT.engine(Object.assign({}, WT.PRESET, { clash, fool }), prng(seed * 77)).deal(), mv2 = prng(seed * 5 + 1);
      let ok = true, k = 0;
      while (!E.over && k++ < 200) {
        const chs = [null, null];
        if (E.phase === "play") for (let p = 0; p < 2; p++) { const h = E.hands[p], c = h[Math.floor(mv2() * h.length)], ch = { c: c.id }; if (h.length > 1 && E.rz[p] < 2 && mv2() < 0.25) ch.x = h.filter(x => x.id !== c.id)[0].id; chs[p] = ch }
        else for (let p = 0; p < 2; p++) if (E.hands[p].length) { if (mv2() < 0.2) chs[p] = { r: 1 }; else { const h = E.hands[p].slice().sort((a, b) => a.n - b.n), nd = E.needDown(p); chs[p] = { down: h.slice(0, nd).map(c => c.id), up: h[h.length - 1].id } } }
        E.step(chs);
      }
      // agent ฝั่งเซิร์ฟเวอร์ใช้ลำดับสุ่มเดียวกัน (เรียก mv ตามลำดับผู้เล่นเดียวกัน) ดังนั้นผลต้องเท่ากัน
      assert.strictEqual(pub.pileN[0] + "-" + pub.pileN[1], E.piles[0].length + "-" + E.piles[1].length, "server result == direct engine result (clash " + clash + ", seed " + seed + ")");
      assert.strictEqual(pub.round, E.round);
    }
    process.stdout.write("");
  }
  console.log("ok  full games via API (u/un/eq × fool on/off × 12 seeds): finishes, 44 cards always, server result == direct engine result, public state clean");

  // --- ช่วงสงคราม ---
  { let found = null;
    for (let seed = 1; seed < 400 && !found; seed++) {
      const s = setup({ clash: "un", fool: 1 }, seed); await startGame(s); const mv = prng(seed); let n = 0;
      while (G(s).status === "playing" && n++ < 60) {
        if (G(s).public_state.phase === "war") { found = s; break }
        for (const p of [0, 1]) await choose(s, s.users[p], agentChoice(s, s.users[p], mv));
      } }
    assert.ok(found, "found a war state"); const s = found, [A, B] = s.users, pub = G(s).public_state;
    assert.strictEqual(pub.phase, "war"); assert.ok(pub.up[0] && pub.up[1] && pub.potN >= 2); assert.deepStrictEqual(pub.need, [3, 3]);
    const hA = hand(s, A).slice(), hB = hand(s, B).slice(); assert.ok(hA.length >= 5);
    assert.strictEqual((await choose(s, A, { down: [hA[0].id], up: hA[1].id })).error, "illegal", "wrong number of down cards");
    assert.strictEqual((await choose(s, A, { down: [hA[0].id, hA[0].id, hA[1].id], up: hA[2].id })).error, "illegal", "duplicate card");
    assert.strictEqual((await choose(s, A, { down: [hB[0].id, hA[1].id, hA[2].id], up: hA[3].id })).error, "illegal", "card from other hand");
    assert.strictEqual((await choose(s, A, { c: hA[0].id })).error, "illegal", "play-phase choice in war");
    const dn = hA.slice(0, 3).map(c => c.id), r1 = await choose(s, A, { down: dn, up: hA[3].id }); assert.ok(r1.ok && !r1.resolved);
    const pj = JSON.stringify(G(s).public_state); [...dn, hA[3].id].forEach(id => assert.ok(!pj.includes('"id":' + id + ','), "war cards must stay hidden"));
    const potBefore = G(s).public_state.potN, r2 = await choose(s, B, { r: 1 }); assert.ok(r2.ok && r2.resolved, JSON.stringify(r2));
    const g2 = G(s).public_state, ret = g2.ev.find(e => e.t === "ret"); assert.ok(ret && ret.p === 1 && ret.w === 0 && ret.n === potBefore, JSON.stringify(g2.ev));
    assert.strictEqual(total(s), 44);
    console.log("ok  war phase: down/up validated, war cards stay hidden, retreat resolves and winner takes the pot"); }

  // --- หมดเวลา / หลุดสัญญาณ / ยอมแพ้ / rematch ---
  { const s = setup(); await startGame(s); const [A, B] = s.users, hA = hand(s, A);
    s.T.player_heartbeats.push({ room_id: s.rid, user_id: A, last_seen_at: new Date(s.CLOCK.t).toISOString() }, { room_id: s.rid, user_id: B, last_seen_at: new Date(s.CLOCK.t).toISOString() });
    await choose(s, A, { c: hA[0].id });
    const hb = () => { s.T.player_heartbeats.forEach(h => { h.last_seen_at = new Date(s.CLOCK.t).toISOString() }) };
    s.CLOCK.t += 30000; hb(); let c = await s.api.handle(A, Object.assign({ action: "war_check" }, { game_id: G(s).id })); assert.strictEqual(c.state, "waiting");
    s.CLOCK.t += 31000; hb(); c = await s.api.handle(A, { action: "war_check", game_id: G(s).id });
    assert.strictEqual(c.state, "forfeited"); assert.strictEqual(c.loser, 1); assert.strictEqual(c.reason, "timeout");
    assert.strictEqual(G(s).status, "finished"); assert.strictEqual(G(s).loser_p, 1); assert.strictEqual(G(s).public_state.res.w, 0); assert.strictEqual(s.T.rooms[0].status, "finished");
    assert.strictEqual((await choose(s, B, { c: hand(s, B)[0].id })).error, "game_over");
    // Rematch (เลียนแบบ nn_rematch: finished → lobby, ทุกคน unready) แล้วเริ่มรอบใหม่
    s.T.rooms[0].status = "lobby"; s.T.room_players.forEach(p => { p.is_ready = true }); await startGame(s); assert.strictEqual(G(s).round_no, 2); assert.strictEqual(s.T.games.length, 2);
    console.log("ok  timeout: waits 60s, then non-committed player loses; rematch starts a fresh game"); }
  { const s = setup(); await startGame(s); const [A, B] = s.users, old = new Date(s.CLOCK.t - 10000).toISOString();
    s.T.player_heartbeats.push({ room_id: s.rid, user_id: A, last_seen_at: new Date(s.CLOCK.t).toISOString() }, { room_id: s.rid, user_id: B, last_seen_at: old });
    await choose(s, A, { c: hand(s, A)[0].id });
    s.CLOCK.t += 70000; s.T.player_heartbeats[0].last_seen_at = new Date(s.CLOCK.t).toISOString();   // เกิน 60 วิ แต่ B หลุดยังไม่ถึง 120 วิ
    let c = await s.api.handle(A, { action: "war_check", game_id: G(s).id }); assert.strictEqual(c.state, "waiting", "disconnected player gets 120s");
    s.CLOCK.t += 60000; s.T.player_heartbeats[0].last_seen_at = new Date(s.CLOCK.t).toISOString();
    c = await s.api.handle(A, { action: "war_check", game_id: G(s).id }); assert.strictEqual(c.state, "forfeited"); assert.strictEqual(c.reason, "disconnected"); assert.strictEqual(c.loser, 1);
    console.log("ok  disconnect: 120s grace, then forfeit"); }
  { const s = setup(); await startGame(s); s.CLOCK.t += 200000;   // ไม่มีใครเลือกเลย และไม่มี heartbeat
    const c = await s.api.handle(s.users[0], { action: "war_check", game_id: G(s).id }); assert.strictEqual(c.state, "abandoned");
    assert.strictEqual(G(s).status, "finished"); assert.ok(G(s).loser_p == null); assert.strictEqual(G(s).public_state.res.w, -1);
    console.log("ok  both idle: abandoned (draw), nobody penalized alone"); }
  { const s = setup(); await startGame(s);
    const f = await s.api.handle(s.users[1], { action: "war_forfeit", game_id: G(s).id }); assert.strictEqual(f.state, "forfeited"); assert.strictEqual(G(s).loser_p, 1); assert.strictEqual(G(s).public_state.res.w, 0);
    assert.strictEqual((await s.api.handle(s.users[0], { action: "war_forfeit", game_id: G(s).id })).state, "over");
    assert.strictEqual((await s.api.handle(uuid(), { action: "war_forfeit", game_id: G(s).id })).error, "not_in_game");
    assert.strictEqual((await s.api.handle(s.users[0], { action: "war_nope" })).error, "bad_action");
    console.log("ok  leave = forfeit, outsiders rejected, unknown action rejected"); }
  // ห้อง/เกมเลขเพดานยังใช้ action เดิมได้ (ไม่กระทบ)
  { const s = setup(); assert.strictEqual((await s.api.handle(s.users[0], { action: "bad" })).error, "bad_action"); }
  console.log("ALL PASSED");
})().catch(e => { console.error(e); process.exit(1) });
