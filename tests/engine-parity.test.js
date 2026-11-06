// รัน:  node tests/engine-parity.test.js
// ตรวจ: (1) engine ที่แยกออกมายังเหมือนใน index.html  (2) ตรรกะเซิร์ฟเวอร์ (nn-server.js) เล่นตาม action เดียวกันแล้วได้สถานะตรงกับ engine ตัวตรง ๆ ทุก action
//       (ลง/เลือกเป้าหมาย/ข้าม Chariot/เลือก Sun/แทรก Empress)  (3) กติกาของเซิร์ฟเวอร์ปฏิเสธ action ผิดตา/ผิดไพ่ และข้อมูลลับไม่หลุดสู่ public
const fs = require("fs"), path = require("path"), assert = require("assert");
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const shared = fs.readFileSync(path.join(root, "online/nn-engine.js"), "utf8");
const NN = require("../online/nn-engine.js");
const SV = require("../online/nn-server.js");
const { prng, agent, wantsInterject } = require("./helpers.js");

function grab(s) {
  const a = s.indexOf("function nnEngine(o,rnd){");
  const b = s.indexOf("return G}", a) + "return G}".length;
  return s.slice(a, b).split("\n").map(l => l.trim()).join("\n");
}
assert.strictEqual(grab(shared), grab(html), "nn-engine.js ไม่ตรงกับ engine ใน index.html");
console.log("ok  (1) engine text identical to index.html");

const FIELDS = ["total", "prev", "dir", "cur", "over", "turn", "shield", "seal", "owe", "calm", "dbl", "force", "hands", "deck", "disc"];
const snapG = G => JSON.stringify(FIELDS.map(k => G[k]));
let games = 0, steps = 0; const kinds = { play: 0, pass: 0, pick: 0, interject: 0 };
for (const n of [2, 3, 4]) for (const cap of [120, 150, 200]) for (let seed = 1; seed <= 120; seed++) {
  const rA = prng(seed * 7919 + n * 31 + cap), rC = prng(seed * 7919 + n * 31 + cap), mv = prng(seed * 104729 + n), mi = prng(seed * 13 + n);
  const A = NN.engine({ cap, n }, rA); A.deal(); A.cur = Math.floor(rA() * n);
  const players = Array.from({ length: n }, (_, i) => ({ user_id: "u" + i, seat: i + 1, name: "P" + i, avatar: "" }));
  const S0 = SV.startGame(players, cap, rC);
  let snap = { pub: S0.pub, secret: S0.secret, hands: S0.hands, uids: S0.uids, extras: {} };
  assert.strictEqual(snap.pub.cur, A.cur);
  let guard = 0;
  const apply = (res) => {
    assert.ok(!res.error, "server error " + res.error);
    snap = { pub: res.pub, secret: res.secret, hands: Object.assign({}, snap.hands, res.hands), uids: snap.uids, extras: Object.assign({}, snap.extras) };
    Object.keys(res.extras || {}).forEach(u => { if (res.extras[u]) snap.extras[u] = res.extras[u]; else delete snap.extras[u]; });
  };
  const same = () => {
    const p = snap.pub;
    assert.strictEqual(p.total, A.total); assert.strictEqual(p.cur, A.cur); assert.strictEqual(p.over, A.over); assert.strictEqual(p.turn, A.turn);
    assert.strictEqual(p.dir, A.dir); assert.strictEqual(p.force, A.force);
    assert.strictEqual(JSON.stringify(p.shield), JSON.stringify(A.shield)); assert.strictEqual(JSON.stringify(p.seal), JSON.stringify(A.seal));
    assert.strictEqual(JSON.stringify(p.owe), JSON.stringify(A.owe)); assert.strictEqual(JSON.stringify(p.calm), JSON.stringify(A.calm));
    assert.strictEqual(JSON.stringify(p.dbl), JSON.stringify(A.dbl));
    assert.strictEqual(JSON.stringify(snap.uids.map(u => snap.hands[u])), JSON.stringify(A.hands));
    assert.strictEqual(JSON.stringify(snap.secret.deck), JSON.stringify(A.deck));
    assert.strictEqual(JSON.stringify(snap.secret.disc), JSON.stringify(A.disc));
    assert.strictEqual(JSON.stringify(p.pend && { t: p.pend.t, p: p.pend.p }), JSON.stringify(A.pend && { t: A.pend.t, p: A.pend.p }));
    if (A.pend && A.pend.cards) assert.strictEqual(JSON.stringify(snap.secret.pend), JSON.stringify(A.pend.cards));
    assert.strictEqual(JSON.stringify(p.rev.map(r => r.p)), JSON.stringify(A.rev.map((x, i) => x ? i : -1).filter(i => i >= 0)));
    const all = [].concat(...A.hands, A.deck, A.disc, A.pend && A.pend.cards ? A.pend.cards : []);
    const base = all.filter(c => c.id < 900).map(c => c.id);
    assert.strictEqual(base.length, 44); assert.strictEqual(new Set(base).size, 44);
  };
  while (A.over < 0) {
    if (++guard > 6000) throw new Error("game did not end");
    // แทรก Empress (ถ้ามี) ก่อนผู้เล่นปัจจุบันลง
    const iu = wantsInterject(snap, mi, 0.4);
    if (iu) {
      const q = snap.uids.indexOf(iu);
      if (A.canInterject(q) >= 0) { assert.ok(A.interject(q)); apply(SV.applyInterject(snap, iu, rC)); kinds.interject++; steps++; same(); if (A.over >= 0) break; continue; }
      assert.strictEqual(SV.applyInterject(snap, iu, rC).error, "cant_interject");      // เช่นถูกบังคับลงใบสูงสุดแต่ Empress ไม่ใช่ใบสูงสุด
    }
    const a = agent(snap, mv), p = snap.uids.indexOf(a.uid);
    if (a.kind === "pick") { assert.ok(A.pick(p, a.idx)); apply(SV.applyPick(snap, a.uid, a.idx, rC)); kinds.pick++; }
    else if (a.kind === "pass") { assert.ok(A.pass(p)); apply(SV.applyPass(snap, a.uid, rC)); kinds.pass++; }
    else {
      const i = A.hands[p].findIndex(c => c.id === a.card_id);
      assert.ok(A.legal(p).includes(i));
      A.play(p, i, a.k, a.tg == null ? undefined : a.tg);
      const res = SV.applyPlay(snap, a.uid, a.card_id, rC, { k: a.k, tg: a.tg });
      if (A.over >= 0) { assert.ok(!res.error, res.error); assert.strictEqual(res.over, p); snap = { pub: res.pub, secret: res.secret, hands: Object.assign({}, snap.hands, res.hands), uids: snap.uids, extras: {} }; kinds.play++; steps++; break; }
      apply(res); kinds.play++;
    }
    steps++; same();
  }
  assert.strictEqual(snap.pub.over, A.over);
  games++;
}
console.log(`ok  (2) ${games} games, ${steps} actions (${JSON.stringify(kinds)}): server logic == engine on every action`);

// (3) กติกาของเซิร์ฟเวอร์
{
  const players = [0, 1, 2].map(i => ({ user_id: "u" + i, seat: i + 1, name: "P" + i, avatar: "" }));
  const r = prng(42), S0 = SV.startGame(players, 150, r);
  const snap = { pub: S0.pub, secret: S0.secret, hands: S0.hands, uids: S0.uids, extras: {} };
  const cur = snap.pub.cur, other = (cur + 1) % 3;
  const myCard = snap.hands[snap.uids[cur]][0].id, otherCard = snap.hands[snap.uids[other]][0].id;
  assert.strictEqual(SV.applyPlay(snap, snap.uids[other], otherCard, r).error, "not_your_turn");
  assert.strictEqual(SV.applyPlay(snap, snap.uids[cur], otherCard, r).error, "card_not_in_hand");
  assert.strictEqual(SV.applyPlay(snap, snap.uids[cur], 99999, r).error, "card_not_in_hand");
  assert.strictEqual(SV.applyPlay(snap, "stranger", myCard, r).error, "not_in_game");
  assert.strictEqual(SV.applyPlay(snap, snap.uids[cur], myCard, r, { k: 9 }).error, "bad_option");
  assert.strictEqual(SV.applyPass(snap, snap.uids[cur], r).error, "no_pending");
  assert.strictEqual(SV.applyPick(snap, snap.uids[cur], 0, r).error, "no_pending");
  assert.strictEqual(SV.applyInterject(snap, snap.uids[cur], r).error, "cant_interject");
  // บังคับใบสูงสุด
  const s2 = JSON.parse(JSON.stringify(snap)); s2.pub.force = cur;
  s2.hands[s2.uids[cur]] = [{ n: 5, id: 5 }, { n: 17, id: 17 }, { n: 9, id: 9 }];
  assert.strictEqual(SV.applyPlay(s2, s2.uids[cur], 5, r).error, "illegal_card");
  assert.ok(!SV.applyPlay(s2, s2.uids[cur], 17, r, { k: 0 }).error);
  // ต้องเลือกเป้าหมายเมื่อมี 3 คนขึ้นไป (Fool / Emperor / Moon)
  const s3 = JSON.parse(JSON.stringify(snap)); s3.hands[s3.uids[cur]] = [{ n: 0, id: 0 }, { n: 4, id: 4 }, { n: 18, id: 18 }];
  [0, 4, 18].forEach(id => { assert.strictEqual(SV.applyPlay(s3, s3.uids[cur], id, r, { k: 0 }).error, "need_target"); assert.strictEqual(SV.applyPlay(s3, s3.uids[cur], id, r, { k: 0, tg: cur }).error, "need_target"); assert.ok(!SV.applyPlay(s3, s3.uids[cur], id, r, { k: 0, tg: other }).error); });
  // จบเกมแล้วลงไม่ได้
  const s4 = JSON.parse(JSON.stringify(snap)); s4.pub.over = 0;
  assert.strictEqual(SV.applyPlay(s4, s4.uids[cur], myCard, r).error, "game_over");
  // public ไม่มีมือ/สำรับ/ไพ่ที่รอเลือก
  assert.ok(!/"deck"|"disc"|"secret"|"cards"/.test(JSON.stringify(S0.pub)), "public leaks");
  assert.strictEqual(SV.startGame(players.slice(0, 1), 150, r).error, "bad_player_count");
  assert.strictEqual(SV.startGame(players, 99, r).error, "bad_cap");
  console.log("ok  (3) turn/card/option/target/force/game-over rules enforced; public state has no hands/deck/pending cards");
}
console.log("ALL PASSED");
