/* HRTA สงครามไพ่ "ยุทธวิธี" (ไม่มีพลังพิเศษ) — engine ฟังก์ชันล้วน ใช้ร่วม client + server (Supabase Edge Function)
 * ส่วนระหว่าง TACTICS_ENGINE_START / TACTICS_ENGINE_END ต้องเหมือนกับที่ฝังใน index.html ทุกตัวอักษร (tests/war-parity ตรวจ)
 * กติกาและลำดับตัดสินดู docs/war-tactics-balance.md
 * ความลับ: engine เก็บสถานะเต็ม (มือ/กองจั่ว) ไว้ฝั่งเซิร์ฟเวอร์เท่านั้น ส่งให้ผู้เล่นผ่าน E.view(p) / E.pub() เท่านั้น
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WarTactics = factory();
})(typeof self !== "undefined" ? self : this, function () {
/*TACTICS_ENGINE_START*/
function wtEngine(R0, rnd) {
  var R = {clash: "u", fool: 1, hand: 3, wh: 7, cap: 60, raise: 1, raiseMax: 2};
  for (var k0 in (R0 || {})) R[k0] = R0[k0];
  rnd = rnd || Math.random;
  var shuf = function (a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t } return a };
  var E = {R: R, deck: [], hands: [[], []], piles: [[], []], disc: [], pot: [], up: [null, null], cs: null, stk: [null, null],
    round: 0, wars: 0, depth: 0, phase: "play", over: null, pub: {}, own: [{}, {}], rz: [0, 0], ev: [],
    st: {rw: [0, 0], ww: [0, 0], ret: [0, 0], maxd: 0, pot: 0}};
  var mark = function (cards) { cards.forEach(function (c) { if (c) E.pub[c.id] = 1 }) };
  var cnum = function (c) { return c ? c.n : -1 };
  var rmId = function (arr, id) { for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr.splice(i, 1)[0]; return null };
  var hasId = function (arr, id) { for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return true; return false };
  var emit = function (o) { E.ev.push(o) };

  E.deal = function () {
    var d = []; for (var k = 0; k < 2; k++) for (var n = 0; n < 22; n++) d.push({n: n, d: k, id: k * 22 + n});
    shuf(d); E.hands = [d.slice(0, R.hand), d.slice(R.hand, 2 * R.hand)]; E.deck = d.slice(2 * R.hand);
    E.piles = [[], []]; E.disc = []; E.pot = []; E.round = 0; E.wars = 0; E.phase = "play"; E.over = null;
    E.pub = {}; E.own = [{}, {}]; E.rz = [0, 0];
    return E;
  };
  E.clashes = function (a, b) { if (a === b) return true; if (R.clash === "eq") return false; if (a % 10 === b % 10) return true; return R.clash === "un" && Math.abs(a - b) === 1 };
  E.draw = function (p) { var c = E.deck.shift(); if (!c) return null; E.hands[p].push(c); return c };
  var drawTo = function (n) { /* จั่วสลับฝั่ง จนมือ >= n หรือกองหมด; ฝั่งที่เริ่มก่อนสลับทุกรอบ */
    var f = E.round % 2, go = true;
    while (go && E.deck.length) { go = false; for (var i = 0; i < 2; i++) { var p = (f + i) % 2; if (E.hands[p].length < n && E.deck.length) { E.draw(p); go = true } } }
  };

  /* ---------- ตรวจการเลือก ---------- */
  E.legalPlay = function (p, ch) {
    if (!(ch && E.phase === "play" && !E.over && hasId(E.hands[p], ch.c))) return false;
    if (ch.x == null) return true;
    return !!R.raise && E.rz[p] < R.raiseMax && ch.x !== ch.c && hasId(E.hands[p], ch.x);
  };
  E.needDown = function (p) { return Math.min(3, Math.max(0, E.hands[p].length - 1)) };
  E.legalWar = function (p, ch) {
    if (E.phase !== "war" || E.over) return false;
    if (!E.hands[p].length) return true;
    if (!ch) return false; if (ch.r) return true;
    var h = E.hands[p], d = ch.down || [], nd = E.needDown(p), seen = {};
    if (d.length !== nd || ch.up == null) return false;
    var all = d.concat([ch.up]);
    for (var i = 0; i < all.length; i++) { if (seen[all[i]] || !hasId(h, all[i])) return false; seen[all[i]] = 1 }
    return true;
  };

  /* ---------- ขั้นตอนหลัก ---------- */
  E.step = function (ch) {
    E.ev = [];
    if (E.over) return E.ev;
    if (E.phase === "play") playStep(ch); else warStep(ch);
    return E.ev;
  };

  function playStep(ch) {
    var cs = [], p;
    for (p = 0; p < 2; p++) { if (!E.legalPlay(p, ch && ch[p])) throw new Error("illegal play p" + p); }
    for (p = 0; p < 2; p++) cs.push(rmId(E.hands[p], ch[p].c));
    var stk = [null, null];
    if (R.raise) for (p = 0; p < 2; p++) if (ch[p].x != null) { stk[p] = rmId(E.hands[p], ch[p].x); E.rz[p]++ }
    E.stk = stk; mark(stk.filter(Boolean));
    E.cs = cs; E.round++; E.up = cs.slice(); E.pot = cs.concat(stk.filter(Boolean)); E.depth = 0; mark(cs);
    emit({t: "flip", r: E.round, up: cs.map(cnum), stk: stk.map(function (c) { return c ? c.n : -1 })});
    var a = cs[0].n, b = cs[1].n, fw = -1;
    if (R.fool) { if (a === 0 && b === 21) fw = 0; else if (a === 21 && b === 0) fw = 1 }
    if (fw >= 0) return settle(fw, false, {fool: true});
    if (E.clashes(a, b)) return startWar();
    return settle(a > b ? 0 : 1, false, {});
  }

  function startWar() {
    E.wars++; E.depth++; if (E.depth > E.st.maxd) E.st.maxd = E.depth;
    E.phase = "war";
    drawTo(R.wh);
    emit({t: "war", d: E.depth, pot: E.pot.length, ups: E.up.map(cnum)});
  }

  function warStep(ch) {
    var p, mode = ["f", "f"];
    for (p = 0; p < 2; p++) {
      if (!E.hands[p].length) mode[p] = "x";
      else { if (!E.legalWar(p, ch && ch[p])) throw new Error("illegal war p" + p); if (ch[p].r) mode[p] = "r" }
    }
    if (mode[0] === "f" && mode[1] === "f") {
      var ups = [], downN = [0, 0];
      for (p = 0; p < 2; p++) {
        var dn = ch[p].down.map(function (id) { return rmId(E.hands[p], id) });
        dn.forEach(function (c) { E.own[p][c.id] = 1 });
        downN[p] = dn.length; E.pot = E.pot.concat(dn); ups.push(rmId(E.hands[p], ch[p].up));
      }
      E.pot = E.pot.concat(ups); E.up = ups; mark(ups);
      emit({t: "lay", ups: ups.map(cnum), dn: downN, pot: E.pot.length});
      var a = ups[0].n, b = ups[1].n, fw = -1;
      if (R.fool) { if (a === 0 && b === 21) fw = 0; else if (a === 21 && b === 0) fw = 1 }
      if (fw >= 0) return settle(fw, true, {fool: true});
      if (E.clashes(a, b)) return startWar();
      return settle(a > b ? 0 : 1, true, {});
    }
    /* มีคนถอย/ไพ่หมด */
    var pot = E.pot.slice(); E.pot = []; E.up = [null, null];
    var f = mode[0] === "f" ? 0 : mode[1] === "f" ? 1 : -1;
    for (p = 0; p < 2; p++) if (mode[p] === "r") E.st.ret[p]++;
    if (f < 0) {
      mark(pot); E.disc = E.disc.concat(pot); emit({t: "ret", both: true, n: pot.length, d: E.depth});
    } else {
      var q = 1 - f;
      E.piles[f] = E.piles[f].concat(pot); mark(pot);
      emit({t: "ret", p: q, w: f, n: pot.length, d: E.depth, forfeit: mode[q] === "x"});
      E.st.rw[f]++; E.st.ww[f]++;
      if (pot.length > E.st.pot) E.st.pot = pot.length;
    }
    E.depth = 0;
    endRound();
  }

  function settle(w, war, o) {
    var pot = E.pot.slice(), depth = E.depth;
    E.piles[w] = E.piles[w].concat(pot); mark(pot);
    E.st.rw[w]++; if (war) E.st.ww[w]++; if (pot.length > E.st.pot) E.st.pot = pot.length;
    if (o.fool) emit({t: "fool", p: w});
    emit({t: "res", w: w, n: pot.length, war: war ? depth : 0, up: E.up.map(cnum)});
    endRound();
  }

  function endRound() {
    drawTo(R.hand);
    E.up = [null, null]; E.pot = []; E.phase = "play";
    if (!E.deck.length && (!E.hands[0].length || !E.hands[1].length)) E.over = "done";
    else if (E.round >= R.cap) E.over = "cap";
    if (E.over) emit({t: "end", why: E.over, s: [E.piles[0].length, E.piles[1].length]});
  }
  E.result = function () { var a = E.piles[0].length, b = E.piles[1].length; return {w: a > b ? 0 : b > a ? 1 : -1, a: a, b: b} };

  /* ---------- มุมมอง ---------- */
  E.pubState = function () { /* ข้อมูลสาธารณะ: ไม่มีมือ/กองจั่ว/ไพ่ที่เลือกแต่ยังไม่เปิด/ไพ่คว่ำ */
    return {round: E.round, phase: E.phase, depth: E.depth, over: E.over, deckN: E.deck.length, handN: [E.hands[0].length, E.hands[1].length],
      pileN: [E.piles[0].length, E.piles[1].length], discN: E.disc.length, potN: E.pot.length,
      up: E.up.map(function (c) { return c ? {n: c.n, d: c.d, id: c.id} : null }), cfg: {clash: R.clash, fool: R.fool}};
  };
  E.view = function (p) {
    var v = E.pubState(), unseen = [], i;
    v.rzLeft = R.raise ? Math.max(0, R.raiseMax - E.rz[p]) : 0; v.p = p; v.hand = E.hands[p].slice(); v.pile = E.piles[p].slice();
    for (i = 0; i < 44; i++) { if (E.pub[i] || E.own[p][i] || hasId(E.hands[p], i)) continue; unseen.push({n: i % 22, d: Math.floor(i / 22), id: i}) }
    v.unseen = unseen; v.R = {clash: R.clash, fool: R.fool, hand: R.hand, wh: R.wh, cap: R.cap, raise: R.raise, raiseMax: R.raiseMax};
    v.need = E.phase === "war" ? E.needDown(p) : 0;
    return v;
  };

  /* ---------- บันทึก/โหลดสถานะ (ใช้ในตัวจำลองของ AI และเซิร์ฟเวอร์) ---------- */
  E.save = function () {
    return {deck: E.deck.slice(), hands: [E.hands[0].slice(), E.hands[1].slice()], piles: [E.piles[0].slice(), E.piles[1].slice()], disc: E.disc.slice(),
      pot: E.pot.slice(), up: E.up.slice(), cs: E.cs, stk: E.stk || [null, null], round: E.round, wars: E.wars, depth: E.depth, phase: E.phase, over: E.over,
      pub: Object.assign({}, E.pub), own: [Object.assign({}, E.own[0]), Object.assign({}, E.own[1])], rz: E.rz.slice(), st: JSON.parse(JSON.stringify(E.st))};
  };
  E.load = function (s) {
    for (var k in s) { var v = s[k]; E[k] = (v && typeof v === "object") ? JSON.parse(JSON.stringify(v)) : v }
    return E;
  };
  return E;
}
/*TACTICS_ENGINE_END*/

/*TACTICS_AI_START*/
/* ===================== AI "น้องเบสท์" (เล่นแฟร์: รับ view ของตัวเองเท่านั้น) ===================== */
var LEVELS = {
  random: {kind: "random"},
  novice: {kind: "mc", samples: 3, noise: 0.7, count: false},
  normal: {kind: "mc", samples: 8, noise: 0, count: false},
  hard:   {kind: "mc", samples: 20, noise: 0, count: true},
  retreatAlways: {kind: "mc", samples: 8, noise: 0, count: false, war: "retreat"},
  retreatNever:  {kind: "mc", samples: 8, noise: 0, count: false, war: "fight"}
};
var FULL = []; for (var _k = 0; _k < 2; _k++) for (var _n = 0; _n < 22; _n++) FULL.push({n: _n, d: _k, id: _k * 22 + _n});

function pickRand(arr, rnd) { return arr[Math.floor(rnd() * arr.length)] }
function shuffled(a, rnd) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t } return a }

/* กลุ่มไพ่ที่ฝั่งตรงข้ามน่าจะถืออยู่ (ตามข้อมูลที่ AI เห็นได้) */
function oppPool(view, lv) {
  if (lv.count) return view.unseen;
  var mine = {}; view.hand.forEach(function (c) { mine[c.id] = 1 });
  return FULL.filter(function (c) { return !mine[c.id] });
}
function sampleOpp(view, lv, rnd, n) {
  var known = [], kid = {};
  var pool = shuffled(oppPool(view, lv).filter(function (c) { return !kid[c.id] }), rnd);
  var take = pool.slice(0, Math.max(0, n - known.length));
  var hh = known.concat(take);
  while (hh.length < n) hh.push(FULL[Math.floor(rnd() * 44)]); /* ข้อมูลที่เห็นไม่พอ (ไพ่ซ่อนในกองรางวัล) → เติมสุ่ม */
  return {hand: hh, rest: pool.slice(take.length)};
}

/* สร้างสถานะจำลองจากมุมมองของ me (ฝั่งตรงข้าม+กองจั่วสุ่มจากสิ่งที่ยังไม่เห็น) */
function determinize(view, lv, rnd) {
  var me = view.p, o = 1 - me, R = Object.assign({}, view.R);
  var s = sampleOpp(view, lv, rnd, view.handN[o]);
  var dummy = function (n) { var a = []; for (var i = 0; i < n; i++) a.push({n: 5, d: 0, id: 100 + i}); return a };
  var deck = s.rest.slice(0, view.deckN);
  while (deck.length < view.deckN) deck.push({n: Math.floor(rnd() * 22), d: 0, id: 200 + deck.length});
  var sim = wtEngine(R, rnd);
  var st = {deck: deck, hands: [[], []], piles: [[], []], disc: dummy(view.discN), pot: [], up: [null, null], cs: null, stk: [null, null],
    round: view.round, wars: 0, depth: 0, phase: "play", over: null, pub: {}, own: [{}, {}],
    rz: me === 0 ? [Math.max(0, view.R.raiseMax - view.rzLeft), 0] : [0, Math.max(0, view.R.raiseMax - view.rzLeft)],
    st: {rw: [0, 0], ww: [0, 0], ret: [0, 0], maxd: 0, pot: 0}};
  st.hands[me] = view.hand.slice(); st.hands[o] = s.hand;
  st.piles[me] = view.pile.slice(); st.piles[o] = dummy(view.pileN[o]);
  return sim.load(st);
}

function rank(c) { return c.n }

/* ตัดสินใจในสงคราม: คืน {r:1} หรือ {down:[ids], up:id} */
function warDecide(view, lvName, rnd) {
  var lv = LEVELS[lvName] || LEVELS.normal, h = view.hand.slice().sort(function (a, b) { return a.n - b.n });
  var nd = view.need;
  var legalFight = function () { var up = h[h.length - 1]; return {down: h.slice(0, nd).map(function (c) { return c.id }), up: up.id} };
  if (lv.kind === "random") {
    if (rnd() < 0.2) return {r: 1};
    var sh = shuffled(h, rnd); return {down: sh.slice(0, nd).map(function (c) { return c.id }), up: sh[nd].id};
  }
  if (lv.war === "retreat") return {r: 1};
  var fight = legalFight();
  if (lv.war === "fight") return fight;
  if (lv.noise && rnd() < lv.noise) { if (rnd() < 0.5) return fight; var sh2 = shuffled(h, rnd); return {down: sh2.slice(0, nd).map(function (c) { return c.id }), up: sh2[nd].id} }
  /* ประเมินโอกาสชนะใบตัดสิน เทียบมือคู่ต่อสู้ที่สุ่มจากข้อมูลที่เห็น (คู่ต่อสู้เลือกใบสูงสุด) */
  var mine = h[h.length - 1].n, W = 0, K = 40, oppN = view.handN[1 - view.p];
  if (!oppN) return fight;
  for (var i = 0; i < K; i++) {
    var oh = sampleOpp(view, lv, rnd, oppN).hand, ob = -1; oh.forEach(function (c) { if (c.n > ob) ob = c.n });
    var cl = (mine === ob) || (view.R.clash !== "eq" && mine % 10 === ob % 10) || (view.R.clash === "un" && Math.abs(mine - ob) === 1);
    W += cl ? 0.5 : (mine > ob ? 1 : (view.R.fool && mine === 0 && ob === 21 ? 1 : (view.R.fool && mine === 21 && ob === 0) ? 0 : 0));
  }
  var p = W / K, T = view.potN + (nd + 1) * 2;
  var cost = view.potN;
  return ((2 * p - 1) * T > -cost) ? fight : {r: 1};
}

/* เลือกไพ่ลงรอบปกติ: คืน {c:id, mag, jud, star, her} */
function playDecide(view, lvName, rnd) {
  var lv = LEVELS[lvName] || LEVELS.normal, hand = view.hand;
  if (lv.kind === "random" || hand.length === 1) { var rc = pickRand(hand, rnd), ro = {c: rc.id}; if (view.rzLeft > 0 && hand.length > 1 && rnd() < 0.3) ro.x = pickRand(hand.filter(function (x) { return x.id !== rc.id }), rnd).id; return ro }
  if (lv.noise && rnd() < lv.noise) return {c: pickRand(hand, rnd).id};
  var me = view.p, o = 1 - me, late = view.deckN <= 2;
  /* ตัวเลือก: ลงใบ c เฉย ๆ หรือลง c + เพิ่มเดิมพันด้วยใบอื่นที่ต่ำสุด */
  var acts = [];
  hand.forEach(function (c) {
    acts.push({c: c.id});
    if (view.rzLeft > 0 && hand.length > 1) {
      var low = null; hand.forEach(function (x) { if (x.id !== c.id && (!low || x.n < low.n)) low = x });
      acts.push({c: c.id, x: low.id});
    }
  });
  var scores = acts.map(function () { return 0 });
  for (var s = 0; s < lv.samples; s++) {
    var base = determinize(view, lv, rnd).save();
    var oh = base.hands[o], oc = pickRand(oh, rnd), ox = null;
    if (view.R.raise && oh.length > 1 && rnd() < 0.2) ox = pickRand(oh.filter(function (x) { return x.id !== oc.id }), rnd);
    acts.forEach(function (a, ai) {
      var sim = wtEngine(view.R, rnd).load(base), oa = {c: oc.id}; if (ox) oa.x = ox.id;
      try {
        sim.step(me === 0 ? [a, oa] : [oa, a]);
        var guard = 0;
        while (sim.phase === "war" && !sim.over && guard++ < 6) {
          var ch = [null, null];
          for (var q = 0; q < 2; q++) ch[q] = warDecide(sim.view(q), "normal", rnd);
          sim.step(ch);
        }
      } catch (e) { return }
      var diff = sim.piles[me].length - sim.piles[o].length, hq = 0;
      sim.hands[me].forEach(function (x) { hq += x.n / 21 - 0.5 }); sim.hands[o].forEach(function (x) { hq -= (x.n / 21 - 0.5) * 0 });
      scores[ai] += diff + (late ? 0 : (lv.keep == null ? 0.5 : lv.keep) * hq);
    });
  }
  var bi = 0; for (var i = 1; i < acts.length; i++) if (scores[i] > scores[bi] + 1e-9) bi = i;
  return acts[bi];
}

var PRESET = {clash: "u", fool: 1, hand: 3, wh: 7, cap: 60, raise: 1, raiseMax: 2};
/*TACTICS_AI_END*/

return {engine: wtEngine, PRESET: PRESET, LEVELS: LEVELS, playDecide: playDecide, warDecide: warDecide, determinize: determinize};
});
