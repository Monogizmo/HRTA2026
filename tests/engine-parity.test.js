// รัน:  node tests/engine-parity.test.js
// ตรวจ 3 อย่าง: (1) engine ที่แยกออกมายังเหมือนใน index.html  (2) เล่นทีละตาแล้วผลตรงกับ engine เดิมทุกตา
// (3) ตรรกะฝั่งเซิร์ฟเวอร์ (nn-server.js) ให้ผลตรงกับ engine เดิม + กติกาตา/ไพ่ถูกบังคับใช้ + ข้อมูลลับไม่หลุดสู่ public
const fs = require("fs"), path = require("path"), assert = require("assert");
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const shared = fs.readFileSync(path.join(root, "online/nn-engine.js"), "utf8");
const NN = require("../online/nn-engine.js");
const SV = require("../online/nn-server.js");

function grab(s) {
  const a = s.indexOf("function nnEngine(o,rnd){");
  const b = s.indexOf("return G}", a) + "return G}".length;
  return s.slice(a, b).split("\n").map(l => l.trim()).join("\n");
}
// (1) ข้อความเหมือนกัน
assert.strictEqual(grab(shared), grab(html), "nn-engine.js ไม่ตรงกับ engine ใน index.html");
console.log("ok  (1) engine text identical to index.html");

const original = new Function(grab(html) + "\nreturn nnEngine;")();
function prng(seed) { let a = seed >>> 0; const f = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; return f; }
const FIELDS = ["cap", "n", "two", "total", "prev", "dir", "cur", "over", "turn", "shield", "dbl", "force", "heatAt", "hands", "deck", "disc"];
const snapG = G => JSON.stringify(FIELDS.map(k => G[k]));

let games = 0, steps = 0, busts = 0;
for (const n of [2, 3, 4]) for (const cap of [120, 150, 200]) for (let seed = 1; seed <= 120; seed++) {
  const rA = prng(seed * 7919 + n * 31 + cap), rB = prng(seed * 7919 + n * 31 + cap), rC = prng(seed * 7919 + n * 31 + cap);
  const mv = prng(seed * 104729 + n);
  // track A: engine เดิมใน index.html
  const A = original({ cap, n }, rA); A.deal(); A.cur = Math.floor(rA() * n);
  // track B: engine ที่แยกออกมา แต่ export/import ทุกตา (จำลองการเก็บลง DB)
  let Bstate; { const G = NN.engine({ cap, n }, rB); G.deal(); G.cur = Math.floor(rB() * n); Bstate = NN.exportState(G); }
  // track C: ตรรกะเซิร์ฟเวอร์เต็มรูปแบบ
  const players = Array.from({ length: n }, (_, i) => ({ user_id: "u" + i, seat: i + 1, name: "P" + i, avatar: "" }));
  const S0 = SV.startGame(players, cap, rC);
  let snap = { pub: S0.pub, secret: S0.secret, hands: S0.hands, uids: S0.uids };
  assert.strictEqual(snap.pub.cur, A.cur);
  let guard = 0;
  while (A.over < 0) {
    if (++guard > 3000) throw new Error("game did not end");
    const p = A.cur, lg = A.legal(p), i = lg[Math.floor(mv() * lg.length)];
    const cardId = A.hands[p][i].id;
    const ra = A.play(p, i, 0);
    // B
    const GB = NN.importState(Bstate, rB); const rb = GB.play(p, i, 0); Bstate = NN.exportState(GB);
    assert.strictEqual(JSON.stringify(rb), JSON.stringify(ra), "B result differs");
    assert.strictEqual(snapG(GB), snapG(A), "B state differs");
    // C
    const res = SV.applyPlay(snap, snap.uids[p], cardId, rC);
    assert.ok(!res.error, "server error " + res.error);
    const nh = Object.assign({}, snap.hands, res.hands);
    snap = { pub: res.pub, secret: res.secret, hands: nh, uids: snap.uids };
    assert.strictEqual(res.pub.total, A.total); assert.strictEqual(res.pub.cur, A.cur);
    assert.strictEqual(res.pub.over, A.over); assert.strictEqual(res.pub.turn, A.turn);
    assert.strictEqual(res.pub.dir, A.dir); assert.strictEqual(res.pub.force, A.force);
    assert.strictEqual(JSON.stringify(res.pub.shield), JSON.stringify(A.shield));
    assert.strictEqual(JSON.stringify(res.pub.dbl), JSON.stringify(A.dbl));
    assert.strictEqual(JSON.stringify(snap.uids.map(u => snap.hands[u])), JSON.stringify(A.hands));
    assert.strictEqual(JSON.stringify(res.secret.deck), JSON.stringify(A.deck));
    assert.strictEqual(JSON.stringify(res.secret.disc), JSON.stringify(A.disc));
    assert.strictEqual(JSON.stringify(res.pub.handCounts), JSON.stringify(A.hands.map(h => h.length)));
    // ไพ่ต้นฉบับ 44 ใบ (id 0–43) ต้องอยู่ครบไม่ซ้ำเสมอ ; ใบเสกของ Magician (id >= 900) เป็นของเพิ่มตามกติกาเดิม
    const all = [].concat(...A.hands, A.deck, A.disc);
    const base = all.filter(c => c.id < 900).map(c => c.id).sort((x, y) => x - y);
    assert.strictEqual(base.length, 44, "base card count != 44");
    assert.strictEqual(new Set(base).size, 44, "duplicate base card");
    steps++;
  }
  busts++; games++;
}
console.log(`ok  (2)(3) ${games} games, ${steps} plays: original == split engine == server logic`);

// (4) กติกาของเซิร์ฟเวอร์
{
  const players = [0, 1, 2].map(i => ({ user_id: "u" + i, seat: i + 1, name: "P" + i, avatar: "" }));
  const r = prng(42), S0 = SV.startGame(players, 150, r);
  let snap = { pub: S0.pub, secret: S0.secret, hands: S0.hands, uids: S0.uids };
  const cur = snap.pub.cur, other = (cur + 1) % 3;
  const myCard = snap.hands[snap.uids[cur]][0].id, otherCard = snap.hands[snap.uids[other]][0].id;
  assert.strictEqual(SV.applyPlay(snap, snap.uids[other], otherCard, r).error, "not_your_turn");
  assert.strictEqual(SV.applyPlay(snap, snap.uids[cur], otherCard, r).error, "card_not_in_hand");
  assert.strictEqual(SV.applyPlay(snap, snap.uids[cur], 99999, r).error, "card_not_in_hand");
  assert.strictEqual(SV.applyPlay(snap, "stranger", myCard, r).error, "not_in_game");
  // บังคับใบสูงสุด
  const s2 = JSON.parse(JSON.stringify(snap)); s2.pub.force = cur;
  s2.hands[s2.uids[cur]] = [{ n: 3, id: 3 }, { n: 17, id: 17 }, { n: 9, id: 9 }];
  assert.strictEqual(SV.applyPlay(s2, s2.uids[cur], 3, r).error, "illegal_card");
  assert.ok(!SV.applyPlay(s2, s2.uids[cur], 17, r).error);
  // จบเกมแล้วลงไม่ได้
  const s3 = JSON.parse(JSON.stringify(snap)); s3.pub.over = 0;
  assert.strictEqual(SV.applyPlay(s3, s3.uids[cur], myCard, r).error, "game_over");
  // public ไม่มีมือ/สำรับ
  const keys = Object.keys(S0.pub).sort().join(",");
  assert.ok(!/hands|deck|disc|secret/.test(keys), "public leaks: " + keys);
  assert.strictEqual(SV.startGame(players.slice(0, 1), 150, r).error, "bad_player_count");
  assert.strictEqual(SV.startGame(players, 99, r).error, "bad_cap");
  console.log("ok  (4) turn/card/force/game-over rules enforced; public state has no hands/deck");
}
console.log("ALL PASSED");
