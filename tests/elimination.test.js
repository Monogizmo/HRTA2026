// รัน: node tests/elimination.test.js — ตรรกะโหมดคัดออกระดับ nn-server (ไม่ผ่าน API) รวม action ใหม่ทั้งหมด
const assert = require("assert");
const SV = require("../online/nn-server.js");
const { prng, agent, wantsInterject } = require("./helpers.js");

let games = 0, elims = 0, twoSwitch = 0, pend = 0, inter = 0;
for (const n of [3, 4]) for (const cap of [120, 150, 200]) for (let seed = 1; seed <= 150; seed++) {
  const rnd = prng(seed * 977 + n), mv = prng(seed * 31 + cap), mi = prng(seed * 17 + n);
  const players = Array.from({ length: n }, (_, i) => ({ user_id: "u" + i, seat: i + 1, name: "P" + i, avatar: "" }));
  const S0 = SV.startGame(players, cap, rnd, "elimination");
  let snap = { pub: S0.pub, secret: S0.secret, hands: S0.hands, uids: S0.uids, extras: {} };
  const apply = (res) => {
    assert.ok(!res.error, res.error);
    snap = { pub: res.pub, secret: res.secret, hands: Object.assign({}, snap.hands, res.hands), uids: snap.uids, extras: Object.assign({}, snap.extras) };
    Object.keys(res.extras || {}).forEach(u => { if (res.extras[u]) snap.extras[u] = res.extras[u]; else delete snap.extras[u]; });
  };
  let guard = 0, prevAlive = n;
  while (snap.pub.over < 0) {
    assert.ok(++guard < 8000, "no end");
    const pub = snap.pub, actorP = pub.pend ? pub.pend.p : pub.cur;
    assert.ok(pub.alive.includes(actorP), "turn to eliminated");
    const iu = wantsInterject(snap, mi, 0.3);
    if (iu) { const r = SV.applyInterject(snap, iu, rnd); if (!r.error) { apply(r); inter++; } }
    else {
      const a = agent(snap, mv); let r;
      if (a.kind === "pick") r = SV.applyPick(snap, a.uid, a.idx, rnd);
      else if (a.kind === "pass") r = SV.applyPass(snap, a.uid, rnd);
      else r = SV.applyPlay(snap, a.uid, a.card_id, rnd, { k: a.k, tg: a.tg });
      apply(r);
    }
    const p = snap.pub;
    // ไพ่ต้นฉบับ 44 ใบ (id<900) ต้องครบไม่ซ้ำเสมอ รวมมือคนตกรอบที่ย้ายลงกองทิ้ง และไพ่ที่รอเลือก
    const all = [].concat(...snap.uids.map(u => snap.hands[u]), snap.secret.deck, snap.secret.disc, snap.secret.pend || []);
    const base = all.filter(x => x.id < 900).map(x => x.id).sort((a, b) => a - b);
    assert.strictEqual(base.length, 44); assert.strictEqual(new Set(base).size, 44);
    // ไพ่ที่รอเลือกเห็นได้เฉพาะผู้เลือก
    if (p.pend && p.pend.t === "pick") { pend++; const u = snap.uids[p.pend.p]; assert.ok(snap.extras[u] && snap.extras[u].pick.length >= 1); assert.strictEqual(Object.keys(snap.extras).length, 1); }
    else assert.strictEqual(Object.keys(snap.extras).length, 0, "stale pending extra");
    p.out.forEach(o => { if (p.over < 0 || o !== p.over) assert.strictEqual(snap.hands[snap.uids[o]].length, 0); });
    if (p.over < 0) {
      assert.ok(p.alive.every(o => !p.out.includes(o)));
      assert.strictEqual(p.handCounts.reduce((a, b) => a + b, 0), p.alive.reduce((a, o) => a + snap.hands[snap.uids[o]].length, 0));
      assert.ok(p.alive.includes(p.pend ? p.pend.p : p.cur));
      if (p.alive.length < prevAlive) { elims++; assert.strictEqual(p.total, 0); assert.strictEqual(p.force, -1); assert.strictEqual(p.dbl, null); assert.strictEqual(p.pend, null); assert.strictEqual(p.seq, null); if (p.alive.length === 2) twoSwitch++; prevAlive = p.alive.length; }
    }
  }
  const p = snap.pub;
  assert.strictEqual(p.out.length, n - 1);
  assert.ok(p.winner != null && !p.out.includes(p.winner));
  assert.strictEqual(new Set(p.out.concat([p.winner])).size, n);
  assert.strictEqual(p.over, p.out[p.out.length - 1]);
  games++;
}
console.log(`ok  elimination logic: ${games} games, ${elims} mid-game eliminations (${twoSwitch} down to 2 players), ${inter} interjections, ${pend} Sun picks; card conservation + turn order + resets hold`);

// โหมดเดี่ยวไม่เปลี่ยน: alive = ทุกคนตลอดเกม, ไม่มี winner
{ const r = prng(5), players = [0, 1, 2].map(i => ({ user_id: "u" + i, seat: i + 1, name: "P" + i, avatar: "" }));
  const S0 = SV.startGame(players, 150, r, "one_loser");
  assert.deepStrictEqual(S0.pub.alive, [0, 1, 2]); assert.strictEqual(S0.pub.winner, null); assert.strictEqual(S0.pub.mode, "one_loser");
  assert.strictEqual(SV.startGame(players, 150, r, "zzz").error, "bad_mode");
  console.log("ok  one_loser: unchanged shape (alive=all, no winner)"); }
console.log("ALL PASSED");
