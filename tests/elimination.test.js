// รัน: node tests/elimination.test.js — ตรรกะโหมดคัดออกระดับ nn-server (ไม่ผ่าน API)
const assert = require("assert");
const SV = require("../online/nn-server.js");
function prng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

let games = 0, elims = 0, twoSwitch = 0;
for (const n of [3, 4]) for (const cap of [120, 150, 200]) for (let seed = 1; seed <= 150; seed++) {
  const rnd = prng(seed * 977 + n), mv = prng(seed * 31 + cap);
  const players = Array.from({ length: n }, (_, i) => ({ user_id: "u" + i, seat: i + 1, name: "P" + i, avatar: "" }));
  const S0 = SV.startGame(players, cap, rnd, "elimination");
  let snap = { pub: S0.pub, secret: S0.secret, hands: S0.hands, private: S0.private, uids: S0.uids };
  let guard = 0, prevAlive = n;
  while (snap.pub.over < 0) {
    assert.ok(++guard < 6000, "no end");
    const pub = snap.pub, cur = pub.cur;
    assert.ok(pub.alive.includes(cur), "turn to eliminated");
    if (pub.pending) {
      const actor = pub.pending.p, uid = snap.uids[actor];
      let result;
      if (pub.pending.type === "sun") {
        const options = snap.private[uid] && snap.private[uid].pending && snap.private[uid].pending.sunOptions || [];
        result = SV.applyChoose(snap, uid, options.length ? Math.floor(mv() * options.length) : 0, rnd);
      } else if (pub.pending.type === "chariot") result = SV.applySkip(snap, uid, rnd);
      else throw new Error("unexpected pending " + pub.pending.type);
      assert.ok(!result.error, result.error);
      snap = Object.assign({}, snap, { pub: result.pub, secret: result.secret,
        hands: Object.assign({}, snap.hands, result.hands), private: Object.assign({}, snap.private, result.private || {}) });
      continue;
    }
    const uid = snap.uids[cur], hand = snap.hands[uid];
    assert.ok(hand.length > 0, "current player has no cards");
    let cand = hand.slice();
    if (pub.force === cur) { const mx = Math.max(...cand.map(c => c.n)); cand = cand.filter(c => c.n === mx); }
    const c = cand[Math.floor(mv() * cand.length)];
    const choice = {};
    if (c.n === 17) choice.value = mv() < 0.5 ? -17 : 17;
    if (c.n === 0) choice.target = pub.alive[Math.floor(mv() * pub.alive.length)];
    if (c.n === 4 || c.n === 18) { const ts = pub.alive.filter(x => x !== cur); choice.target = ts[Math.floor(mv() * ts.length)]; }
    const res = SV.applyPlay(snap, uid, c.id, rnd, choice);
    assert.ok(!res.error, res.error);
    snap = { pub: res.pub, secret: res.secret, hands: Object.assign({}, snap.hands, res.hands),
      private: Object.assign({}, snap.private, res.private || {}), uids: snap.uids };
    const p = snap.pub;
    // ไพ่ต้นฉบับ 44 ใบ (id<900) ต้องครบไม่ซ้ำเสมอ รวมมือคนตกรอบที่ถูกย้ายลงกองทิ้ง
    const sunCards = Object.values(snap.private || {}).flatMap(x => x && x.pending && x.pending.sunOptions || []);
    const all = [].concat(...snap.uids.map(u => snap.hands[u]), snap.secret.deck, snap.secret.disc, sunCards);
    const base = all.filter(x => x.id < 900).map(x => x.id).sort((a, b) => a - b);
    assert.strictEqual(base.length, 44); assert.strictEqual(new Set(base).size, 44);
    // ผู้เล่นที่ตกรอบ: ไม่มีไพ่ ไม่มีโล่ ไม่ถูกบังคับ
    p.out.forEach(o => { if (p.over < 0 || o !== p.over) { assert.strictEqual(snap.hands[snap.uids[o]].length, 0); } });
    p.out.forEach(o => { assert.ok(!p.alive.includes(o) || o === p.over); });
    if (p.over < 0) {
      assert.ok(p.alive.every(o => !p.out.includes(o)));
      assert.strictEqual(p.two, p.alive.length === 2);
      assert.strictEqual(p.handCounts.reduce((a, b) => a + b, 0), p.alive.reduce((a, o) => a + snap.hands[snap.uids[o]].length, 0));
      if (p.alive.length < prevAlive) { elims++; assert.strictEqual(p.total, 0); assert.strictEqual(p.force, -1); assert.strictEqual(p.pending, null); if (p.alive.length === 2) twoSwitch++; prevAlive = p.alive.length; }
    }
  }
  const p = snap.pub;
  assert.strictEqual(p.out.length, n - 1);
  assert.ok(p.winner != null && !p.out.includes(p.winner));
  assert.strictEqual(new Set(p.out.concat([p.winner])).size, n);
  assert.strictEqual(p.over, p.out[p.out.length - 1]);
  games++;
}
console.log(`ok  elimination logic: ${games} games, ${elims} mid-game eliminations (${twoSwitch} switched to 2-player powers), card conservation + turn order + pile reset hold`);

// โหมดเดี่ยวไม่เปลี่ยน: alive = ทุกคนตลอดเกม, ไม่มี winner
{ const r = prng(5), players = [0, 1, 2].map(i => ({ user_id: "u" + i, seat: i + 1, name: "P" + i, avatar: "" }));
  const S0 = SV.startGame(players, 150, r, "one_loser");
  assert.deepStrictEqual(S0.pub.alive, [0, 1, 2]); assert.strictEqual(S0.pub.winner, null); assert.strictEqual(S0.pub.mode, "one_loser");
  assert.strictEqual(SV.startGame(players, 150, r, "zzz").error, "bad_mode");
  console.log("ok  one_loser: unchanged shape (alive=all, no winner)"); }
console.log("ALL PASSED");
