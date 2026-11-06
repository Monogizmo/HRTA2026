/* เทสต์ engine สงครามไพ่ยุทธวิธี (ไม่มีพลังพิเศษ): ตัดสินรอบ, ชนกัน u/un/eq, คนโง่ล้มเจ้าโลก, สงคราม/ถอย/ซ้อนศึก, เพิ่มเดิมพัน, ข้อมูลลับ, AI ไม่แอบดู */
const W = require("../online/war-engine.js"), S = require("../tools/war-sim.js");
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL:", m) } };
const C = (n, d = 0) => ({n, d, id: d * 22 + n});
function setup(h0, h1, deck, o) {
  o = o || {};
  const E = W.engine(Object.assign({}, W.PRESET, o.R || {}), S.mulberry(o.seed || 7)).deal();
  E.hands = [h0.map(n => C(n, 0)), h1.map(n => C(n, 0))];
  E.deck = deck.map(n => C(n, 1)); E.pub = {}; E.piles = [[], []]; E.disc = []; return E;
}
const D = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const play = (E, a, b, ex) => E.step([Object.assign({c: C(a).id}, (ex && ex[0]) || {}), Object.assign({c: C(b).id}, (ex && ex[1]) || {})]);
const warAuto = (E, who) => { const ch = [null, null]; for (let p = 0; p < 2; p++) { const h = E.hands[p].slice().sort((x, y) => x.n - y.n), nd = E.needDown(p);
  ch[p] = who && who[p] === "r" ? {r: 1} : {down: h.slice(0, nd).map(c => c.id), up: h[h.length - 1].id} } return E.step(ch) };

/* ตัดสินรอบ: เลขมากชนะ เก็บทั้งสองใบ */
{ const E = setup([9, 1, 2], [3, 8, 5], D); play(E, 9, 3); ok(E.piles[0].length === 2 && E.piles[1].length === 0 && E.phase === "play", "higher wins both");
  const F = setup([3, 1, 2], [9, 8, 5], D); play(F, 3, 9); ok(F.piles[1].length === 2, "lower loses"); }
/* ไม่มีพลังใด ๆ: ไม่มี event ชนิด pow */
for (let n = 0; n < 22; n++) { const o = (n + 5) % 22; const E = setup([n, 1, 2], [o, 8, 9], D); if (E.clashes(n, o) || (n === 0 && o === 21)) continue;
  const ev = play(E, n, o); ok(ev.every(e => ["flip", "res"].indexOf(e.t) >= 0) && E.piles[0].length + E.piles[1].length === 2, "no special power for " + n); }
/* ชนกัน u / un / eq */
{ const U = setup([1, 2, 3], [11, 8, 9], D); play(U, 1, 11); ok(U.phase === "war", "u: same units clash");
  const N1 = setup([1, 2, 3], [12, 8, 9], D, {R: {clash: "un"}}); play(N1, 1, 12); ok(N1.phase === "play", "un: units differ by 1 but numbers differ by 11 → no clash");
  const N2 = setup([4, 2, 3], [5, 8, 9], D, {R: {clash: "un"}}); play(N2, 4, 5); ok(N2.phase === "war", "un: diff 1 clash");
  const Q = setup([4, 2, 3], [5, 8, 9], D, {R: {clash: "u"}}); play(Q, 4, 5); ok(Q.phase === "play", "u: diff 1 no clash");
  const Z = setup([7, 2, 3], [17, 8, 9], D, {R: {clash: "eq"}}); play(Z, 7, 17); ok(Z.phase === "play", "eq: only equal clash");
  const Y = setup([7, 2, 3], [7, 8, 9], D, {R: {clash: "eq"}}); play(Y, 7, 7); ok(Y.phase === "war", "eq: equal clash"); }
/* คนโง่ล้มเจ้าโลก */
{ const E = setup([0, 1, 2], [21, 8, 9], D); play(E, 0, 21); ok(E.piles[0].length === 2 && E.ev.some(e => e.t === "fool"), "Fool beats World");
  const G = setup([0, 1, 2], [21, 8, 9], D, {R: {fool: 0}}); play(G, 0, 21); ok(G.piles[1].length === 2, "fool=0: World wins"); }
/* สงคราม */
{ const E = setup([1, 2, 3], [11, 8, 9], D); play(E, 1, 11); ok(E.phase === "war" && E.hands[0].length === 7 && E.hands[1].length === 7, "war: both draw up to wh"); 
  ok(E.needDown(0) === 3, "need 3 down"); warAuto(E);
  ok(E.phase === "play" && E.piles[0].length + E.piles[1].length === 10 && (E.piles[0].length === 0 || E.piles[1].length === 0), "war: winner takes whole table (2+8)");
  const F = setup([1, 2, 3], [11, 8, 9], D); play(F, 1, 11); warAuto(F, ["r", "f"]); ok(F.piles[1].length === 2 && F.piles[0].length === 0, "retreat loses only the clashed 2");
  const G = setup([1, 2, 3], [11, 8, 9], D); play(G, 1, 11); warAuto(G, ["r", "r"]); ok(G.disc.length === 2 && G.piles[0].length + G.piles[1].length === 0, "both retreat → discard");
  const H = setup([1, 2, 3], [11, 8, 9], D); play(H, 1, 11); let t = false; try { H.step([{r: 1}, {down: [1], up: 2}]) } catch (e) { t = true } ok(t, "illegal war choice throws"); }
/* ซ้อนศึก: ใบตัดสินชนกัน → วางต่อ; ถอยตอนซ้อนศึกเสียทั้งกองที่ถึงตอนนั้น */
{ const E = setup([1, 2, 3], [11, 8, 9], [20, 20, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17, 18, 19, 3, 4], {}); play(E, 1, 11);
  const h0 = E.hands[0].map(c => c.n), h1 = E.hands[1].map(c => c.n);
  const mk = (p, up) => { const h = E.hands[p].filter(c => c.id !== up), dn = h.slice(0, 3).map(c => c.id); return {down: dn, up} };
  /* บังคับใบตัดสินให้ชนกันเอง: เลือกใบที่หลักหน่วยตรงกัน (ถ้ามี) */
  let pair = null; E.hands[0].forEach(a => E.hands[1].forEach(b => { if (!pair && a.n % 10 === b.n % 10) pair = [a, b] }));
  if (pair) { E.step([mk(0, pair[0].id), mk(1, pair[1].id)]); ok(E.phase === "war" && E.depth === 2, "stacked war on clashing deciders");
    const pot = E.pot.length; E.step([{r: 1}, mk(1, E.hands[1][0].id)]); ok(E.piles[1].length === pot, "retreat at depth 2 loses whole pot"); }
  else ok(true, "no clashing pair available in this seed (skipped)"); }
/* เพิ่มเดิมพัน */
{ const E = setup([9, 1, 2], [3, 4, 5], D); play(E, 9, 3, [{x: C(1).id}, {x: C(4).id}]); ok(E.piles[0].length === 4 && E.rz[0] === 1 && E.rz[1] === 1, "raise: winner takes stakes");
  const F = setup([3, 1, 2], [9, 4, 5], D); play(F, 3, 9, [{x: C(1).id}, {}]); ok(F.piles[1].length === 3, "raise: loser's stake goes to winner");
  const bad = setup([9, 1, 2], [3, 4, 5], D, {R: {raise: 0}}); ok(!bad.legalPlay(0, {c: C(9).id, x: C(1).id}), "raise disabled → illegal");
  const lim = setup([9, 1, 2], [3, 4, 5], D, {R: {raiseMax: 2}}); lim.rz = [2, 0]; ok(!lim.legalPlay(0, {c: C(9).id, x: C(1).id}), "raiseMax respected");
  ok(!setup([9, 1, 2], [3, 4, 5], D).legalPlay(0, {c: C(9).id, x: C(9).id}), "stake must differ from played card");
  let t = false; try { setup([9, 1, 2], [3, 4, 5], D).step([{c: 999}, {c: C(3).id}]) } catch (e) { t = true } ok(t, "illegal play throws"); }
/* จบเกม */
{ const E = setup([9], [3], []); play(E, 9, 3); ok(E.over === "done" && E.result().w === 0, "game ends when deck+hand empty"); }
/* ข้อมูลลับ */
{ const E = setup([9, 1, 2], [3, 4, 5], D); const ps = JSON.stringify(E.pubState()); ok(!/hand"|"deck"|"hands"/.test(ps), "pubState keys");
  const v = E.view(0); ok(JSON.stringify(Object.keys(v)).indexOf("hands") < 0 && v.hand.length === 3 && v.handN[1] === 3, "view shape");
  ok(!v.hand.some(c => E.hands[1].some(x => x.id === c.id)), "my hand != opp hand"); }
/* AI ไม่แอบดู: สลับไพ่ที่ซ่อน (มือ+กองจั่วของอีกฝั่ง) แล้วการตัดสินใจต้องเท่าเดิม */
for (const lvl of ["novice", "normal", "hard"]) {
  const R = Object.assign({}, W.PRESET); let same = true, tested = 0;
  for (let g = 0; g < 8; g++) {
    const r = S.mulberry(100 + g), E = W.engine(R, r).deal();
    for (let k = 0; k < g * 2 && !E.over; k++) { const ch = [null, null]; if (E.phase === "play") for (let p = 0; p < 2; p++) ch[p] = W.playDecide(E.view(p), "random", r); else for (let p = 0; p < 2; p++) ch[p] = E.hands[p].length ? W.warDecide(E.view(p), "random", r) : null; E.step(ch) }
    if (E.over) continue;
    const E2 = W.engine(R, r).load(E.save());
    const hid = E2.hands[1].concat(E2.deck).filter(c => !E2.pub[c.id]), sh = hid.slice().reverse(), swap = new Map(); hid.forEach((c, i) => swap.set(c.id, sh[i]));
    const n1 = E2.hands[1].length, all = E2.hands[1].concat(E2.deck).map(c => swap.get(c.id) || c); E2.hands[1] = all.slice(0, n1); E2.deck = all.slice(n1);
    const dec = (X, v) => X.phase === "play" ? W.playDecide(v, lvl, S.mulberry(5)) : W.warDecide(v, lvl, S.mulberry(5));
    const v1 = E.view(0), v2 = E2.view(0); if (JSON.stringify(v1) !== JSON.stringify(v2)) { same = false; ok(false, "views differ " + lvl); continue }
    tested++; if (JSON.stringify(dec(E, v1)) !== JSON.stringify(dec(E2, v2))) same = false;
    if (E.phase === "play") { /* ทดสอบช่วงสงครามด้วย */
      const c = [{c: E.hands[0][0].id}, {c: E.hands[1][0].id}]; const A = W.engine(R, S.mulberry(9)).load(E.save()), Bq = W.engine(R, S.mulberry(9)).load(E2.save());
      try { A.step(c); Bq.step(c); if (A.phase === "war" && Bq.phase === "war") { tested++; if (JSON.stringify(dec(A, A.view(0))) !== JSON.stringify(dec(Bq, Bq.view(0)))) same = false } } catch (e) {} }
  }
  ok(same && tested > 0, "AI " + lvl + " blind to hidden cards (" + tested + " states)");
}
console.log(fail ? "FAILED " + fail + " / " + (pass + fail) : "war-engine: all " + pass + " checks passed");
process.exit(fail ? 1 : 0);
