// รัน: node tests/engine-cards.test.js — ทดสอบพลังไพ่ชุดใหม่ทีละใบ + จำลอง AI เล่นกันหลายพันเกม
const assert = require("assert");
const NN = require("../online/nn-engine.js");
function prng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const card = (n, id) => ({ n, id: id == null ? n : id });
// สร้างเกมสำหรับทดสอบ: hands = [[n..],[n..],..] ; deck = [n..] ; total
function mk(n, hands, o) {
  o = o || {};
  const G = NN.engine({ cap: o.cap || 120, n }, prng(o.seed || 1));
  G.deal();
  G.hands = hands.map((h, p) => h.map((x, i) => card(x, 100 + p * 10 + i)));
  G.deck = (o.deck || [1, 1, 1, 1, 1, 1, 1, 1]).map((x, i) => card(x, 200 + i));
  G.disc = []; G.total = o.total || 0; G.turn = o.turn || 0; G.cur = o.cur || 0;
  return G;
}
const idx = (G, p, n) => G.hands[p].findIndex(c => c.n === n);
const sizes = G => G.hands.map(h => h.length);
let ok = 0; const t = (name, f) => { f(); ok++; console.log("ok  " + name); };

t("0 Fool: เลือกคนสลับมือ หลังจั่วคืน", () => {
  const G = mk(3, [[0, 5, 6], [7, 8, 9], [10, 11, 12]], { deck: [30, 31, 32] });
  const r = G.play(0, 0, 0, 2);
  assert.strictEqual(r.tg, 2); assert.strictEqual(G.total, 0);
  assert.deepStrictEqual(G.hands[2].map(c => c.n).sort((a, b) => a - b), [5, 6, 30]);      // มือของ p0 (หลังจั่ว 30) ไปอยู่กับ p2
  assert.deepStrictEqual(G.hands[0].map(c => c.n).sort((a, b) => a - b), [10, 11, 12]);
  assert.deepStrictEqual(sizes(G), [3, 3, 3]); assert.strictEqual(G.cur, 1);
});
t("2 Priestess: สลับหลักสิบ/หน่วยแล้ว +2 (47→76, 120→104)", () => {
  let G = mk(2, [[2, 5, 6], [7, 8, 9]], { total: 47 }); G.play(0, 0, 0); assert.strictEqual(G.total, 76);
  G = mk(2, [[2, 5, 6], [7, 8, 9]], { total: 100, cap: 200 }); G.play(0, 0, 0); assert.strictEqual(G.total, 102);
  G = mk(2, [[2, 5, 6], [7, 8, 9]], { total: 120, cap: 150 }); G.play(0, 0, 0); assert.strictEqual(G.total, 104);
});
t("3 Empress: ตาตัวเอง = +3 ธรรมดา", () => {
  const G = mk(3, [[3, 5, 6], [7, 8, 9], [10, 11, 12]], { total: 10 });
  G.play(0, 0, 0); assert.strictEqual(G.total, 13); assert.strictEqual(G.owe[0], false); assert.strictEqual(G.cur, 1); assert.deepStrictEqual(sizes(G), [3, 3, 3]);
});
t("3 Empress: แทรกตอนไม่ใช่ตา → ไม่จั่วทันที / ตาปกติถัดไปไม่ลง แค่จั่ว 1", () => {
  const G = mk(3, [[5, 6, 7], [3, 8, 9], [10, 11, 12]], { total: 10, cur: 0 });
  assert.strictEqual(G.canInterject(0), -1);                     // ตาตัวเองแทรกไม่ได้
  const r = G.interject(1);
  assert.ok(r.interject); assert.strictEqual(G.total, 13); assert.strictEqual(G.cur, 0);    // ตาของคน 0 ยังอยู่
  assert.strictEqual(G.hands[1].length, 2); assert.strictEqual(G.owe[1], true);
  assert.strictEqual(G.canInterject(1), -1);                     // แทรกซ้ำไม่ได้
  G.play(0, 0, 0);                                               // คน 0 ลง → ถึงคน 1 ที่ต้อง "จั่วแทน" → ข้าม → คน 2
  assert.strictEqual(G.hands[1].length, 3); assert.strictEqual(G.owe[1], false); assert.strictEqual(G.cur, 2);
});
t("3 Empress: แทรกแล้วเกินเพดาน = แพ้ทันที ; โล่ช่วยได้", () => {
  let G = mk(3, [[5, 6, 7], [3, 8, 9], [10, 11, 12]], { total: 119, cur: 0 }); const r = G.interject(1); assert.ok(r.bust); assert.strictEqual(G.over, 1);
  G = mk(3, [[5, 6, 7], [3, 8, 9], [10, 11, 12]], { total: 119, cur: 0 }); G.shield[1] = true; const r2 = G.interject(1); assert.ok(r2.saved && !r2.bust); assert.strictEqual(G.total, 105);
});
t("4 Emperor: ผนึกไพ่ใบถัดไปของเป้าหมาย → บวกเลขหน้าไพ่เฉยๆ (ไฟลามยังบวก)", () => {
  const G = mk(3, [[4, 5, 6], [8, 9, 10], [11, 12, 13]], { total: 10 });
  const r = G.play(0, 0, 0, 1); assert.strictEqual(r.tg, 1); assert.strictEqual(G.seal[1], true); assert.strictEqual(G.total, 14);
  G.play(1, idx(G, 1, 8), 0);                                    // Strength ถูกผนึก → +8 ไม่ใช่ ×2
  assert.strictEqual(G.total, 22); assert.strictEqual(G.seal[1], false);
  // ผนึก World = +21 (ไม่ดันเป็นเพดาน), ผนึก Star = +17
  const H = mk(2, [[4, 5, 6], [21, 17, 9]], { total: 10 }); H.play(0, 0, 0, 1); H.play(1, idx(H, 1, 21), 0); assert.strictEqual(H.total, 35);
});
t("5/6 Hierophant ริบต่ำสุด · Lovers บังคับสูงสุด (ไม่มีเปิดไพ่)", () => {
  let G = mk(2, [[5, 20, 20], [3, 9, 15]], { deck: [30, 31] }); G.play(0, 0, 0);
  assert.ok(!G.hands[1].some(c => c.n === 3)); assert.strictEqual(G.hands[1].length, 3);
  G = mk(2, [[6, 20, 20], [3, 9, 15]], { deck: [30, 31] }); G.play(0, 0, 0); assert.strictEqual(G.force, 1);
  assert.deepStrictEqual(G.legal(1).map(i => G.hands[1][i].n), [15]);
});
t("7 Chariot: ลงเพิ่มได้ 1 ใบ จั่วหลังลงครบ ; ข้ามได้", () => {
  let G = mk(3, [[7, 5, 6], [8, 9, 10], [11, 12, 13]], { total: 0, deck: [30, 31, 32, 33] });
  let r = G.play(0, 0, 0);
  assert.strictEqual(r.pend, "extra"); assert.strictEqual(G.cur, 0); assert.strictEqual(G.hands[0].length, 2);          // ยังไม่จั่ว
  G.play(0, 0, 0);                                               // ใบที่ 2 (5)
  assert.strictEqual(G.hands[0].length, 3); assert.strictEqual(G.pend, null); assert.strictEqual(G.cur, 1);               // จั่ว 2 ใบครบ 3
  assert.strictEqual(G.total, 12);
  G = mk(3, [[7, 5, 6], [8, 9, 10], [11, 12, 13]], { deck: [30, 31, 32, 33] }); G.play(0, 0, 0);
  G.pass(0); assert.strictEqual(G.hands[0].length, 3); assert.strictEqual(G.cur, 1);
});
t("15 Devil: คนถัดไปลง 2 ใบติด ไม่จั่วคั่น แล้วจั่ว 2 ; Chariot ซ้อนไม่เกิน 2 ใบ", () => {
  let G = mk(3, [[15, 5, 6], [7, 9, 10], [11, 12, 13]], { deck: [30, 31, 32, 33, 34, 35] });
  G.play(0, 0, 0); assert.deepStrictEqual(G.dbl, { p: 1, left: 2 }); assert.strictEqual(G.cur, 1);
  let r = G.play(1, idx(G, 1, 9), 0); assert.strictEqual(r.pend, "forced"); assert.strictEqual(G.hands[1].length, 2); assert.strictEqual(G.cur, 1);
  G.play(1, 0, 0); assert.strictEqual(G.hands[1].length, 3); assert.strictEqual(G.dbl, null); assert.strictEqual(G.cur, 2);
  // Chariot เป็นใบที่ 1 ของคนที่ถูก Devil: ไม่ได้ใบเพิ่ม (ยังรวม 2 ใบ)
  G = mk(3, [[15, 5, 6], [7, 9, 10], [11, 12, 13]], { deck: [30, 31, 32, 33, 34, 35] }); G.play(0, 0, 0);
  r = G.play(1, idx(G, 1, 7), 0); assert.strictEqual(r.pend, "forced"); G.play(1, 0, 0); assert.strictEqual(G.pend, null); assert.strictEqual(G.cur, 2);
});
t("17 Star: เลือก −17/+17 ; ช่วงไฟลามทุ่ง = ไฟไม่บวกให้ตัวเอง 2 ตา (คนอื่นยังโดน)", () => {
  let G = mk(3, [[17, 5, 6], [7, 8, 9], [10, 11, 12]], { total: 50, turn: 30 });   // heatAt=20 → ตอนนี้ไฟ >0
  assert.ok(G.heat() > 0); const h = G.heat();
  assert.strictEqual(G.opts(17).length, 2);
  G.play(0, 0, 0);                                               // k=0 → −17 ; ไฟไม่บวก
  assert.strictEqual(G.total, 33); assert.strictEqual(G.calm[0], 1);
  G.play(1, 0, 0); assert.ok(G.total > 33 + 7 - 1);              // คนอื่นโดนไฟ
  const before = G.total; G.play(2, 0, 0); // คน 2
  G.cur = 0; G.hands[0].unshift(card(4, 301)); const tt = G.total; G.play(0, 0, 0, 1); assert.strictEqual(G.total, tt + 4); assert.strictEqual(G.calm[0], 0);   // ตาที่ 2 ไฟไม่บวก
  const x = G.total; G.cur = 0; G.hands[0].unshift(card(4, 302)); G.play(0, 0, 0, 1); assert.strictEqual(G.total, x + 4 + G.heat());     // หมดแล้ว ไฟกลับมา
  // นอกช่วงไฟ: แค่ ±17 ไม่มี calm
  G = mk(2, [[17, 5, 6], [7, 8, 9]], { total: 50, turn: 0 }); G.play(0, 0, 1); assert.strictEqual(G.total, 67); assert.strictEqual(G.calm[0], 0);
  G = mk(2, [[17, 5, 6], [7, 8, 9]], { total: 10 }); G.play(0, 0, 0); assert.strictEqual(G.total, 0);
});
t("18 Moon: +เลขหน่วยของกอง (109→+9) แล้วทิ้งไพ่ในมือกี่ใบก็ได้ จั่วใหม่เท่าที่ทิ้ง (หลังจั่วคืน)", () => {
  let G = mk(2, [[18, 5, 6], [7, 8, 9]], { deck: [30, 31, 32, 33, 34], total: 100, cap: 200 }); G.total = 109;
  const r = G.play(0, 0, 0);
  assert.strictEqual(G.total, 118); assert.strictEqual(r.pend, "moon"); assert.strictEqual(G.cur, 0);
  assert.deepStrictEqual(G.hands[0].map(c => c.n), [5, 6, 30]);                      // จั่วคืนปกติก่อน
  assert.strictEqual(G.swap(1, [0]), null);                                          // คนอื่นสลับไม่ได้
  G.swap(0, [0, 1, 1, 99, -1]);                                                      // ดัชนีซ้ำ/นอกช่วงถูกข้าม → ทิ้ง 2 ใบ (5, 6)
  assert.deepStrictEqual(G.hands[0].map(c => c.n).sort((a, b) => a - b), [30, 31, 32]);
  assert.deepStrictEqual(G.disc.map(c => c.n).sort((a, b) => a - b), [5, 6, 18]); assert.strictEqual(G.cur, 1); assert.strictEqual(G.pend, null);
  G = mk(2, [[18, 5, 6], [7, 8, 9]], { deck: [30, 31, 32], total: 50 }); G.play(0, 0, 0); assert.strictEqual(G.total, 50);      // หน่วย 0 → +0
  assert.ok(G.swap(0, [])); assert.deepStrictEqual(G.hands[0].map(c => c.n), [5, 6, 30]); assert.strictEqual(G.cur, 1);          // ไม่เปลี่ยนเลยก็ได้
  G = mk(2, [[18, 5, 6], [7, 8, 9]], { deck: [30, 31, 32, 33], total: 117, cap: 120 }); const r2 = G.play(0, 0, 0); assert.ok(r2.bust);   // 117+7 = 124 > 120 แพ้ ไม่มีสลับ
  G = mk(2, [[18, 5, 6], [7, 8, 9]], { deck: [30], total: 12 }); G.disc = [card(40, 300), card(41, 301)]; G.play(0, 0, 0);
  G.swap(0, [0, 1, 2]); assert.strictEqual(G.hands[0].length, 3);                    // กองจั่วหมด → สับกองทิ้งมาจั่ว ไม่ได้ใบที่เพิ่งทิ้งกลับมาทันที
});
t("19 Sun: ดันเพดาน +19 → +19 → Heat ถาวร +1 (ใบที่ลงไม่โดนไฟ · ไม่มีทางแพ้ · สะสมไม่จำกัด)", () => {
  let G = mk(2, [[19, 5, 6], [7, 8, 9]], { total: 120 });                         // กองเต็มเพดานพอดี ลง Sun ก็รอด
  let r = G.play(0, 0, 0);
  assert.ok(!r.bust); assert.strictEqual(G.cap, 139); assert.strictEqual(G.total, 139); assert.strictEqual(G.hb, 1); assert.strictEqual(r.heat, 0);
  assert.strictEqual(G.heat(), 1); assert.strictEqual(G.hands[0].length, 3); assert.strictEqual(G.cur, 1);
  G.play(1, 0, 0); assert.strictEqual(G.total, 139 + 7 + 1);                       // ใบถัดไปโดนไฟ +1 ทันที (ยังไม่ถึงช่วงไฟ)
  G = mk(2, [[19, 19, 6], [7, 8, 9]], { total: 10, turn: 60 }); assert.ok(G.heat() > 0);
  const h0 = G.heat(); r = G.play(0, 0, 0); assert.strictEqual(r.heat, 0); assert.strictEqual(G.total, 29); assert.strictEqual(G.heat(), h0 + 1);   // ไฟเดิมก็ไม่บวกให้ Sun
  G.play(1, 0, 0); G.play(0, idx(G, 0, 19), 0); assert.strictEqual(G.cap, 158); assert.strictEqual(G.hb, 2);     // Sun สองใบ = +38 / ไฟ +2
  G = mk(2, [[19, 5, 6], [7, 8, 9]], { total: 30 }); G.seal[0] = true; G.play(0, 0, 0); assert.strictEqual(G.cap, 120); assert.strictEqual(G.hb, 0); assert.strictEqual(G.total, 49);   // ถูกผนึก = +19 เฉยๆ
});
t("20 Judgement เดิม · 9 Hermit โล่ · 13 Rebirth · 14 Temperance ปัดขึ้น+ย้อนทิศ", () => {
  let G = mk(3, [[20, 5, 6], [7, 8, 9], [10, 11, 12]], { deck: [30, 31, 32, 33, 34] }); G.play(0, 0, 0);
  assert.ok(!G.hands[1].some(c => c.n === 9) && !G.hands[2].some(c => c.n === 12));
  G = mk(2, [[9, 5, 6], [7, 8, 9]], { total: 100 }); G.play(0, 0, 0); assert.strictEqual(G.shield[0], true);
  G.play(1, 0, 0); G.total = 118; G.play(0, idx(G, 0, 5), 0); assert.strictEqual(G.total, 105); assert.strictEqual(G.shield[0], false);   // โล่ช่วยเมื่อเกิน: กอง = เพดาน−15
  G = mk(3, [[14, 5, 6], [7, 8, 9], [10, 11, 12]], { total: 51 }); G.play(0, 0, 0);
  assert.strictEqual(G.total, 51 + Math.ceil((120 - 51) / 2)); assert.strictEqual(G.dir, -1); assert.strictEqual(G.cur, 2);
});
t("21 World: กอง = เพดานเสมอ ไฟลามทุ่งไม่มีผล · ถ้าถูกผนึก = +21", () => {
  const G = mk(2, [[21, 5, 6], [7, 8, 9]], { total: 30, turn: 60 }); assert.ok(G.heat() > 0);
  const r = G.play(0, 0, 0); assert.strictEqual(G.total, 120); assert.ok(!r.bust); assert.strictEqual(r.heat, 0);
});
t("เลขติดลบขั้นต่ำ 0 · ลำดับ: ลง→คำนวณ→แพ้→พลัง→จั่ว (แพ้แล้วไม่ใช้พลัง/ไม่จั่ว)", () => {
  let G = mk(3, [[11, 5, 6], [7, 8, 9], [10, 11, 12]], { total: 1 }); G.play(0, 0, 0); assert.strictEqual(G.total, 0);
  G = mk(3, [[5, 7, 6], [7, 8, 9], [10, 11, 12]], { total: 118 }); const r = G.play(0, 0, 0); assert.ok(r.bust); assert.strictEqual(G.hands[0].length, 2); assert.strictEqual(G.hands[1].length, 3); // ไม่ริบ ไม่จั่ว
});

/* ---- จำลอง AI เล่นกันหลายพันเกม: ต้องจบ ไม่พัง ไพ่ครบ ---- */
let games = 0, plays = 0, inter = 0, extra = 0, picks = 0; const stat = { turns: 0, byCard: {}, worlds: 0 };
for (const n of [2, 3, 4]) for (const cap of [120, 150, 200]) for (let seed = 1; seed <= 150; seed++) {
  const G = NN.engine({ cap, n }, prng(seed * 7919 + n * 31 + cap)); G.deal(); let guard = 0;
  while (G.over < 0) {
    assert.ok(++guard < 6000, "game did not end");
    // โอกาสแทรก: ผู้เล่นที่ไม่ใช่ตา
    if (!G.seq && !G.pend) for (let q = 0; q < n && G.over < 0; q++) if (q !== G.cur && G.aiInterject(q)) { G.interject(q); inter++; }
    if (G.over >= 0) break;
    const p = G.pend ? G.pend.p : G.cur, a = G.aiStep(p);
    if (a.t === "swap") { assert.ok(G.swap(p, a.ix)); picks++; }
    else if (a.t === "pass") { assert.ok(G.pass(p)); extra++; }
    else {
      assert.ok(G.legal(p).includes(a.i), "illegal ai card");
      if (G.pend && G.pend.t === "extra") extra++;
      const r = G.play(p, a.i, a.k, a.tg); plays++; stat.byCard[r.c.n] = (stat.byCard[r.c.n] || 0) + 1;
    }
    const all = [].concat(...G.hands, G.deck, G.disc, G.pend && G.pend.cards ? G.pend.cards : []);
    const base = all.filter(x => x.id < 900).map(x => x.id);
    assert.strictEqual(new Set(base).size, base.length, "duplicate card");
    assert.ok(base.length >= 44 - 0 && base.length <= 44, "base card count " + base.length);
    G.hands.forEach(h => assert.ok(h.length <= 5, "hand too big"));
  }
  games++; stat.turns += G.turn;
}
console.log(`ok  AI simulation: ${games} games, ${plays} plays (${inter} interjections, ${extra} chariot-extra/pass, ${picks} moon swaps), avg ${(stat.turns / games).toFixed(1)} turns`);
console.log(`ALL PASSED (${ok} card tests)`);
