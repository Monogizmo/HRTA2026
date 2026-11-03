// @ts-nocheck
// ไฟล์นี้สร้างอัตโนมัติจาก tools/build-edge.js — อย่าแก้ตรง ๆ (แก้ที่ online/*.js หรือ tools/edge-main.ts แล้วรัน: node tools/build-edge.js)
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
const self = globalThis;

/* ===== online/nn-engine.js ===== */
/* HRTA Number Ceiling — Shared game engine v3.
 * One ruleset for offline, online and server simulation.
 * All card scoring is resolved here; the host UI only supplies explicit choices.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NNEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var RES = [0, 9, 11, 12, 13, 16, 17, 18, 20];
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function nnEngine(o, rnd) {
    rnd = rnd || Math.random;
    var n = Number(o.n), cap = Number(o.cap);
    var G = {
      cap: cap, n: n, two: n === 2, hands: [], deck: [], disc: [], total: 0, prev: 0,
      dir: 1, cur: 0, over: -1, turn: 0, heatAt: Math.round(cap / 6),
      shield: [], force: -1, sealed: [], revealed: -1, revealedHand: {},
      devil: [], skipDraw: [], starSafe: [], sunOptions: {}, pending: null,
      phase: "await_play", turnState: { p: 0, kind: "normal", played: 0, need: 1, sunChosen: false, postDraw: [] }
    };
    G.heat = function () { return G.turn >= G.heatAt ? 1 + Math.floor((G.turn - G.heatAt) / 6) : 0; };
    G.heatFor = function (p, cardN) {
      if (cardN === 21) return 0;
      if (G.starSafe[p] > 0 || cardN === 17) return 0;
      return G.heat();
    };
    function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
    function ensureDeck(count) {
      if (G.deck.length < count && G.disc.length) G.deck = shuffle(G.deck.concat(G.disc.splice(0)));
    }
    G.deal = function () {
      var d = []; for (var k = 0; k < 2; k++) for (var c = 0; c < 22; c++) d.push({ n: c, id: k * 22 + c });
      G.deck = shuffle(d); G.disc = []; G.hands = []; G.shield = []; G.sealed = []; G.skipDraw = []; G.starSafe = []; G.devil = [];
      for (var p = 0; p < G.n; p++) { G.hands.push(G.deck.splice(0, 3)); G.shield.push(false); G.sealed.push(false); G.skipDraw.push(false); G.starSafe.push(0); G.devil.push(false); }
      G.cur = 0; G.turn = 0; G.total = 0; G.prev = 0; G.dir = 1; G.over = -1; G.force = -1; G.revealed = -1; G.revealedHand = {}; G.sunOptions = {}; G.pending = null; G.phase = "await_play";
      G.turnState = { p: G.cur, kind: "normal", played: 0, need: 1, sunChosen: false, postDraw: [] };
    };
    G.draw = function (p) { ensureDeck(1); if (G.deck.length) G.hands[p].push(G.deck.shift()); };
    G.drawMany = function (p, count) { for (var x = 0; x < count; x++) G.draw(p); };
    G.drawThree = function (p) { ensureDeck(3); var out = []; for (var x = 0; x < 3 && G.deck.length; x++) out.push(G.deck.shift()); G.sunOptions[p] = out; return out; };
    G.low = function (p) { var h = G.hands[p], m = 0; if (!h.length) return -1; h.forEach(function (c, i) { if (c.n < h[m].n) m = i; }); return m; };
    G.dump = function (p) { var h = G.hands[p]; if (!h.length) return; var m = 0; h.forEach(function (c, i) { if (c.n > h[m].n) m = i; }); G.disc.push(h.splice(m, 1)[0]); G.draw(p); };
    G.dumpLow = function (p) { var h = G.hands[p], m = G.low(p); if (m < 0) return; G.disc.push(h.splice(m, 1)[0]); G.draw(p); };
    G.next = function (p) { return ((p + G.dir) % G.n + G.n) % G.n; };
    G.legal = function (p) {
      var h = G.hands[p], out = [], mx = -1; h.forEach(function (c) { if (c.n > mx) mx = c.n; });
      h.forEach(function (c, i) { if (G.force !== p || c.n === mx) out.push(i); }); return out;
    };
    function swapHands(a, b) { var x = G.hands[a]; G.hands[a] = G.hands[b]; G.hands[b] = x; }
    function addDevil(p) { if (p >= 0 && p < G.n) G.devil[p] = true; }
    function validTarget(p, target, allowSelf) { return Number.isInteger(target) && target >= 0 && target < G.n && (allowSelf || target !== p); }
    function scoreFor(c, choice, p, before, rollback) {
      var n = c.n, set = null, v = n, fx = "";
      switch (n) {
        case 0: fx = "fool"; v = 0; break;
        case 1: fx = "conj"; v = 1; break;
        case 2: set = Math.floor(before / 100) * 100 + (before % 10) * 10 + Math.floor((before % 100) / 10) + 2; fx = "priestess"; break;
        case 3: v = 3; fx = "empress"; break;
        case 4: v = 4; fx = "emperor"; break;
        case 5: v = 5; fx = "rob"; break;
        case 6: v = 6; fx = "force"; break;
        case 7: v = 7; fx = "chariot"; break;
        case 8: set = before * 2; fx = "strength"; break;
        case 9: v = 9; fx = "shield"; break;
        case 10: v = Math.floor(rnd() * 41) - 15; fx = "wheel"; break;
        case 11: set = Math.floor(before / 2); fx = "justice"; break;
        case 12: set = Math.max(0, G.cap - before); fx = "hanged"; break;
        case 13: set = Math.max(0, rollback); fx = "rebirth"; break;
        case 14: set = Math.ceil((before + G.cap) / 2); fx = "temperance"; break;
        case 15: v = 15; fx = "devil"; break;
        case 16: set = 0; fx = "tower"; break;
        case 17: v = choice && choice.value === -17 ? -17 : 17; fx = "star"; break;
        case 18: v = 0; fx = "moon"; break;
        case 19: v = 19; fx = "sun"; break;
        case 20: v = 20; fx = "judgement"; break;
        case 21: set = G.cap; fx = "world"; break;
      }
      return { set: set, v: v, fx: fx };
    }
    function optsText(n) {
      var map = {
        0: "+0 เลือกผู้เล่นแล้วสลับมือหลังจั่ว", 1: "+1 เปลี่ยนไพ่ต่ำสุดของคนถัดไปเป็น Devil 15",
        2: "สลับหลักสิบ/หน่วย แล้ว +2", 3: "+3", 4: "+4 ผนึกพลังไพ่ของเป้าหมาย",
        5: "+5 ริบไพ่ต่ำสุดของคนถัดไป", 6: "+6 บังคับคนถัดไปลงใบสูงสุด", 7: "+7 เลือกลงเพิ่มอีก 1 ใบหรือข้าม",
        8: "คูณสอง", 9: "+9 รับโล่ 1 ชั้น", 10: "สุ่ม −15 ถึง +25", 11: "กองเหลือครึ่งเดียว ปัดลง",
        12: "กองใหม่ = เพดาน − กองเดิม", 13: "ย้อนคะแนนก่อนหน้า 1 ใบ", 14: "ดันครึ่งทางสู่เพดาน ปัดขึ้น และย้อนทิศ",
        15: "+15 คนถัดไปต้องลง 2 ใบติดกัน", 16: "ล้างกองเป็น 0", 17: "เลือก −17 หรือ +17",
        18: "+0 เปิดมือผู้เล่นอื่น", 19: "+19 เลือก 1 จาก 3 ใบแทนการจั่วปกติ", 20: "+20 ทุกคนทิ้งไพ่สูงสุดแล้วจั่วใหม่", 21: "กองเท่ากับเพดานทันที"
      };
      return map[n] || ("+" + n);
    }
    G.opts = function (n) {
      if (n === 17) return [{ t: "−17", v: -17 }, { t: "+17", v: 17 }];
      return [{ t: optsText(n), v: n, fx: n === 7 ? "chariot" : undefined }];
    };
    function updateReveal() {
      if (G.revealed >= 0) G.revealedHand[G.revealed] = clone(G.hands[G.revealed] || []);
    }
    function finishTurn() {
      var ts = G.turnState, p = ts.p;
      var draws = Math.max(0, ts.played - (ts.sunChosen ? 1 : 0));
      G.drawMany(p, draws);
      (ts.postDraw || []).forEach(function (fx) { if (fx.type === "swap") swapHands(p, fx.target); });
      if (G.starSafe[p] > 0) G.starSafe[p] = Math.max(0, G.starSafe[p] - 1);
      updateReveal();
      var from = p, guard = 0, next = G.next(from);
      G.pending = null; G.phase = "await_play";
      while (guard++ < G.n * 3) {
        G.cur = next;
        if (G.revealed === next) { G.revealed = -1; delete G.revealedHand[next]; }
        if (G.devil[next]) {
          G.devil[next] = false;
          // A rare hand-size edge case (e.g. a prior Empress interruption) must not deadlock a forced Devil turn.
          while (G.hands[next].length < 2 && (G.deck.length || G.disc.length)) G.draw(next);
          G.turnState = { p: next, kind: "devil", played: 0, need: Math.min(2, G.hands[next].length), sunChosen: false, postDraw: [] };
          if (G.turnState.need < 1) { G.draw(next); G.turnState.need = Math.min(1, G.hands[next].length); }
          updateReveal(); return;
        }
        if (G.skipDraw[next]) {
          G.skipDraw[next] = false; G.draw(next);
          if (G.starSafe[next] > 0) G.starSafe[next] = Math.max(0, G.starSafe[next] - 1);
          updateReveal(); from = next; next = G.next(from); continue;
        }
        G.turnState = { p: next, kind: "normal", played: 0, need: 1, sunChosen: false, postDraw: [] };
        updateReveal(); return;
      }
      G.over = -2; G.phase = "game_over";
    }
    function applyEffect(p, c, fx, choice) {
      var nx = G.next(p), target = choice && choice.target;
      if (fx === "fool") G.turnState.postDraw.push({ type: "swap", target: target });
      else if (fx === "conj") {
        var h = G.hands[nx], m = G.low(nx);
        if (m >= 0) { G.disc.push(h[m]); h[m] = { n: 15, id: 900 + G.turn }; }
      } else if (fx === "emperor") G.sealed[target] = true;
      else if (fx === "rob") G.dumpLow(nx);
      else if (fx === "force") G.force = nx;
      else if (fx === "shield") G.shield[p] = true;
      else if (fx === "devil") addDevil(nx);
      else if (fx === "temperance") G.dir = -G.dir;
      else if (fx === "star") { if (G.turn - 1 >= G.heatAt) G.starSafe[p] = 2; }
      else if (fx === "moon") { G.revealed = target; updateReveal(); }
      else if (fx === "sun") {
        var opts = G.drawThree(p); G.pending = { type: "sun", p: p }; G.phase = "await_sun";
        return { pending: { type: "sun", p: p, count: opts.length }, sunOptions: opts };
      } else if (fx === "judgement") {
        for (var q = 0; q < G.n; q++) G.dump(q);
      }
      return null;
    }
    G.play = function (p, i, k, choice) {
      choice = choice || {};
      if (G.over >= 0 || G.phase === "game_over") return { error: "game_over" };
      var isChariotSecond = G.pending && G.pending.type === "chariot";
      if (G.pending && !isChariotSecond) return { error: "choice_pending" };
      if (p !== G.cur || p !== G.turnState.p) return { error: "not_your_turn" };
      if (!Number.isInteger(i) || i < 0 || i >= G.hands[p].length) return { error: "bad_card_index" };
      var card = G.hands[p][i], sealed = !!G.sealed[p];
      if (G.legal(p).indexOf(i) < 0) return { error: "illegal_card" };
      var baseFx = sealed ? "sealed" : (card.n === 0 ? "fool" : card.n === 1 ? "conj" : card.n === 2 ? "priestess" : card.n === 3 ? "empress" : card.n === 4 ? "emperor" : card.n === 5 ? "rob" : card.n === 6 ? "force" : card.n === 7 ? "chariot" : card.n === 8 ? "strength" : card.n === 9 ? "shield" : card.n === 10 ? "wheel" : card.n === 11 ? "justice" : card.n === 12 ? "hanged" : card.n === 13 ? "rebirth" : card.n === 14 ? "temperance" : card.n === 15 ? "devil" : card.n === 16 ? "tower" : card.n === 17 ? "star" : card.n === 18 ? "moon" : card.n === 19 ? "sun" : card.n === 20 ? "judgement" : "world");
      // Explicit choices are validated before mutating state.
      var nx = G.next(p);
      if (!sealed && card.n === 17 && ![-17, 17].includes(choice.value)) return { error: "choice_required", choice: "star" };
      if (!sealed && (card.n === 0 || card.n === 4 || card.n === 18)) {
        var selfOk = card.n === 0;
        var target = choice.target;
        if (card.n === 0 && G.n === 2) target = nx;
        if ((card.n === 4 || card.n === 18) && G.n === 2) target = nx;
        if (!validTarget(p, target, selfOk)) return { error: "choice_required", choice: card.n === 0 ? "fool_target" : card.n === 4 ? "emperor_target" : "moon_target" };
        choice.target = target;
      }
      if (isChariotSecond) { G.pending = null; G.phase = "await_play"; G.turnState.need = 2; }
      if (G.force === p) G.force = -1; // บังคับเฉพาะไพ่ใบแรกที่ลง
      if (sealed) G.sealed[p] = false;
      G.hands[p].splice(i, 1);
      var before = G.total, rollback = G.prev, fx = sealed ? "sealed" : baseFx;
      var score = sealed ? { set: null, v: card.n, fx: "sealed" } : scoreFor(card, choice, p, before, rollback);
      var nextTotal = score.set != null ? score.set : Math.max(0, before + score.v);
      var heat = G.heatFor(p, sealed ? -1 : card.n);
      nextTotal = Math.max(0, nextTotal + heat);
      // World always lands exactly on cap and ignores Heat; Star ignores Heat on its own card.
      if (card.n === 21 && !sealed) nextTotal = G.cap;
      var saved = false;
      if (nextTotal > G.cap && G.shield[p]) { G.shield[p] = false; saved = true; nextTotal = Math.max(0, G.cap - 15); }
      G.total = nextTotal; G.prev = before; G.turn++; G.disc.push(card);
      G.turnState.played++;
      var bust = nextTotal > G.cap;
      var r = { p: p, c: card, o: { t: optsText(card.n) }, before: before, after: nextTotal, heat: heat, fx: fx,
        nx: [0, 4, 18].indexOf(card.n) >= 0 && !sealed ? choice.target : nx, target: choice.target == null ? null : choice.target,
        saved: saved, bust: bust, sealed: sealed, pending: null };
      if (bust) { G.over = p; G.pending = null; G.phase = "game_over"; return r; }
      if (!sealed) {
        var pend = applyEffect(p, card, fx, choice);
        if (pend) { r.pending = pend.pending; r.sunOptions = pend.sunOptions; }
      }
      // Moon exposes a live hand snapshot: keep it in sync with steals, mass discards,
      // replacements, and other effects even during a multi-card / pending turn.
      updateReveal();
      if (card.n === 17 && !sealed && G.turn - 1 >= G.heatAt) G.starSafe[p] = Math.max(G.starSafe[p], 2);
      if (r.pending) return r;
      if (!isChariotSecond && card.n === 7 && G.turnState.kind === "normal" && G.turnState.played === 1) {
        G.pending = { type: "chariot", p: p }; G.phase = "await_chariot"; r.pending = { type: "chariot", p: p };
        return r;
      }
      if (G.turnState.played < G.turnState.need) return r; // Devil: must play second card without drawing.
      finishTurn();
      return r;
    };
    G.choose = function (p, choice) {
      choice = choice || {};
      if (!G.pending || G.pending.p !== p) return { error: "no_pending_choice" };
      if (G.pending.type === "sun") {
        var opts = G.sunOptions[p] || [], index = choice.index;
        if (!Number.isInteger(index) || index < 0 || index >= opts.length) return { error: "bad_choice" };
        var selected = opts.splice(index, 1)[0];
        // Two unselected cards go to the bottom of the deck, in their reveal order.
        opts.forEach(function (c) { G.deck.push(c); });
        G.hands[p].push(selected); delete G.sunOptions[p];
        G.turnState.sunChosen = true; G.pending = null; G.phase = "await_play";
        if (G.turnState.played >= G.turnState.need) finishTurn();
        return { ok: true, chosen: selected };
      }
      return { error: "bad_choice" };
    };
    G.skip = function (p) {
      if (!G.pending || G.pending.type !== "chariot" || G.pending.p !== p) return { error: "no_pending_choice" };
      G.pending = null; G.phase = "await_play"; finishTurn(); return { ok: true };
    };
    G.interrupt = function (p, i) {
      if (G.phase !== "await_play" || G.pending || p === G.cur || G.over >= 0 || G.turnState.played > 0) return { error: "interrupt_closed" };
      if (p < 0 || p >= G.n || G.skipDraw[p] || G.sealed[p]) return { error: "interrupt_unavailable" };
      if (!Number.isInteger(i) || i < 0 || i >= G.hands[p].length || G.hands[p][i].n !== 3 || G.legal(p).indexOf(i) < 0) return { error: "not_empress" };
      if (G.force === p) G.force = -1;
      var card = G.hands[p].splice(i, 1)[0], before = G.total, heat = G.heatFor(p, 3), after = Math.max(0, before + 3 + heat), saved = false;
      if (after > G.cap && G.shield[p]) { G.shield[p] = false; saved = true; after = Math.max(0, G.cap - 15); }
      G.total = after; G.prev = before; G.turn++; G.disc.push(card);
      var bust = after > G.cap;
      if (!bust) G.skipDraw[p] = true; else { G.over = p; G.phase = "game_over"; }
      updateReveal();
      return { p: p, c: card, before: before, after: after, heat: heat, fx: "interrupt", nx: G.cur, saved: saved, bust: bust, interrupt: true };
    };
    G.canInterrupt = function (p) { return Number.isInteger(p) && p >= 0 && p < G.n && G.phase === "await_play" && !G.pending && G.turnState.played === 0 && p !== G.cur && !G.skipDraw[p] && !G.sealed[p] && G.hands[p].some(function (c, i) { return c.n === 3 && G.legal(p).indexOf(i) >= 0; }); };
    function aiTarget(p, mode) {
      var choices = [];
      for (var q = 0; q < G.n; q++) if (q !== p) {
        var h = G.hands[q] || [], sum = h.reduce(function (a, c) { return a + c.n; }, 0), hi = h.reduce(function (a, c) { return Math.max(a, c.n); }, 0);
        choices.push({ p: q, score: mode === "fool" ? sum : mode === "emperor" ? hi * 3 + sum : G.next(p) === q ? 100 : sum });
      }
      choices.sort(function (a, b) { return b.score - a.score; });
      return choices.length ? choices[0].p : p;
    }
    G.ai = function (p) {
      var best = null, bs = -1e9, heat = G.heatFor(p, -1), legal = G.legal(p);
      legal.forEach(function (i) {
        var c = G.hands[p][i], variants = c.n === 17 ? [-17, 17] : [null];
        variants.forEach(function (v) {
          var before = G.total, base = c.n === 21 ? G.cap : c.n === 8 ? before * 2 : c.n === 11 ? Math.floor(before / 2) : c.n === 12 ? Math.max(0, G.cap - before) : c.n === 13 ? G.prev : c.n === 14 ? Math.ceil((before + G.cap) / 2) : c.n === 16 ? 0 : c.n === 17 ? Math.max(0, before + v) : Math.max(0, before + c.n);
          var h = c.n === 21 || c.n === 17 || G.starSafe[p] > 0 ? 0 : G.heat(), t = Math.max(0, base + h), s;
          if (t > G.cap) s = G.shield[p] ? G.cap - 45 : -1000 - (t - G.cap) * 5;
          else { s = t + rnd() * 8; if (RES.indexOf(c.n) >= 0 && t < G.cap - 25) s -= 12; if (c.n === 21) s += 3; if (c.n === 17 && v === -17) s += 5; }
          if (s > bs) {
            bs = s; var choice = {};
            if (c.n === 17) choice.value = v;
            if (c.n === 0) choice.target = G.n === 2 ? G.next(p) : aiTarget(p, "fool");
            if (c.n === 4) choice.target = aiTarget(p, "emperor");
            if (c.n === 18) choice.target = G.next(p);
            best = { i: i, k: 0, choice: choice };
          }
        });
      });
      return best || { i: 0, k: 0, choice: {} };
    };
    G.aiChooseSun = function (p) {
      var a = G.sunOptions[p] || []; if (!a.length) return 0;
      var best = 0, score = -1e9, t = G.total, capLeft = G.cap - t;
      a.forEach(function (c, i) {
        var v = c.n, s = 0;
        if (c.n === 16) s = t > 35 ? 35 : 9;
        else if (c.n === 13) s = G.prev < t ? 28 : 2;
        else if (c.n === 11) s = t > 55 ? 30 : 8;
        else if (c.n === 12) s = capLeft < 50 ? 27 : 5;
        else if (c.n === 21) s = capLeft <= 25 ? 32 : 12;
        else if (c.n === 9) s = capLeft <= 35 ? 24 : 10;
        else if (c.n === 17) s = G.heat() ? 22 : 8;
        else if (c.n === 8) s = t < capLeft ? t / 4 : -5;
        else if (c.n === 14) s = capLeft < 45 ? 18 : 5;
        else s = Math.max(0, 16 - v) - (v + G.heat() > capLeft ? 18 : 0);
        s += rnd() * 1.5; if (s > score) { score = s; best = i; }
      });
      return best;
    };
    G.aiChariot = function (p) {
      var a = G.ai(p), c = G.hands[p][a.i]; if (!c) return { skip: true };
      var before = G.total, base;
      if (c.n === 8) base = before * 2;
      else if (c.n === 11) base = Math.floor(before / 2);
      else if (c.n === 12) base = Math.max(0, G.cap - before);
      else if (c.n === 13) base = G.prev;
      else if (c.n === 14) base = Math.ceil((before + G.cap) / 2);
      else if (c.n === 16) base = 0;
      else if (c.n === 21) base = G.cap;
      else if (c.n === 17) base = Math.max(0, before + a.choice.value);
      else if (c.n === 10) base = Math.max(0, before + 5);
      else base = Math.max(0, before + c.n);
      var heat = G.heatFor(p, c.n), total = c.n === 21 ? G.cap : Math.max(0, base + heat);
      if (total > G.cap && !G.shield[p]) return { skip: true };
      return a;
    };
    return G;
  }
  var KEYS = ["cap", "n", "two", "hands", "deck", "disc", "total", "prev", "dir", "cur", "over", "turn", "heatAt", "shield", "force", "sealed", "revealed", "revealedHand", "devil", "skipDraw", "starSafe", "sunOptions", "pending", "phase", "turnState"];
  function exportState(G) { var s = {}; KEYS.forEach(function (k) { s[k] = G[k]; }); return clone(s); }
  function importState(s, rnd) { var G = nnEngine({ cap: s.cap, n: s.n }, rnd), c = clone(s); KEYS.forEach(function (k) { if (c[k] !== undefined) G[k] = c[k]; }); return G; }
  return { engine: nnEngine, exportState: exportState, importState: importState };
});

/* ===== online/nn-server.js ===== */
/* HRTA Number Ceiling — server-side state adapter and authoritative rules. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./nn-engine.js"));
  else root.NNServer = factory(root.NNEngine);
})(typeof self !== "undefined" ? self : this, function (NN) {
  "use strict";
  var LOG_MAX = 10;
  function copy(x) { return JSON.parse(JSON.stringify(x)); }
  function range(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); return a; }
  function mapLocalToOriginal(local, alive) {
    if (local == null || local < 0) return -1;
    return alive[local] == null ? -1 : alive[local];
  }
  function pubFrom(G, alive, np, meta) {
    var shield = [], sealed = [], skipDraw = [], starSafe = [], devil = [], hc = [];
    for (var o = 0; o < np; o++) { shield[o] = false; sealed[o] = false; skipDraw[o] = false; starSafe[o] = 0; devil[o] = false; hc[o] = 0; }
    alive.forEach(function (orig, i) {
      shield[orig] = !!G.shield[i]; sealed[orig] = !!G.sealed[i]; skipDraw[orig] = !!G.skipDraw[i];
      starSafe[orig] = Number(G.starSafe[i] || 0); devil[orig] = !!G.devil[i]; hc[orig] = G.hands[i].length;
    });
    var revealedHand = {};
    Object.keys(G.revealedHand || {}).forEach(function (k) {
      var local = Number(k), orig = alive[local]; if (orig != null && alive.indexOf(orig) >= 0) revealedHand[orig] = copy(G.revealedHand[k]);
    });
    var pending = G.pending ? { type: G.pending.type, p: mapLocalToOriginal(G.pending.p, alive) } : null;
    var ts = G.turnState || {};
    var turnState = {
      p: mapLocalToOriginal(ts.p, alive), kind: ts.kind, played: ts.played, need: ts.need,
      sunChosen: !!ts.sunChosen,
      postDraw: (ts.postDraw || []).map(function (x) { return { type: x.type, target: mapLocalToOriginal(x.target, alive) }; })
    };
    return {
      v: 3, mode: meta.mode, np: np, alive: alive.slice(), out: meta.out.slice(),
      cap: G.cap, n: G.n, two: G.two, heatAt: G.heatAt, total: G.total, prev: G.prev,
      dir: G.dir, cur: mapLocalToOriginal(G.cur, alive), turn: G.turn, heat: G.heat(),
      seq: meta.seq, turns: meta.turns, shield: shield, sealed: sealed, skipDraw: skipDraw,
      starSafe: starSafe, devil: devil, force: G.force < 0 ? -1 : mapLocalToOriginal(G.force, alive),
      revealed: G.revealed < 0 ? -1 : mapLocalToOriginal(G.revealed, alive), revealedHand: revealedHand,
      pending: pending, phase: G.phase, turnState: turnState,
      over: meta.over, winner: meta.winner, handCounts: hc, players: meta.players,
      last: meta.last || null, log: meta.log || []
    };
  }
  function startGame(players, cap, rnd, mode) {
    mode = mode || "one_loser";
    var ps = players.slice().sort(function (a, b) { return a.seat - b.seat; }), n = ps.length;
    if (n < 2 || n > 4) return { error: "bad_player_count" };
    if ([120, 150, 200].indexOf(cap) < 0) return { error: "bad_cap" };
    if (mode !== "one_loser" && mode !== "elimination") return { error: "bad_mode" };
    var G = NN.engine({ cap: cap, n: n }, rnd); G.deal(); G.cur = Math.floor(rnd() * n);
    G.turnState.p = G.cur;
    var pl = ps.map(function (x, p) { return { p: p, seat: x.seat, name: x.name, avatar: x.avatar }; });
    var hands = {}, privateStates = {};
    ps.forEach(function (x, p) { hands[x.user_id] = G.hands[p]; privateStates[x.user_id] = { hand: G.hands[p], pending: null }; });
    return {
      pub: pubFrom(G, range(n), n, { mode: mode, out: [], seq: 0, turns: 0, over: -1, winner: null, players: pl, last: null, log: [] }),
      secret: { deck: G.deck, disc: G.disc }, hands: hands, private: privateStates,
      uids: ps.map(function (x) { return x.user_id; }), cur: G.cur
    };
  }
  function engineFrom(snap) {
    var pub = snap.pub, alive = pub.alive, local = {};
    alive.forEach(function (o, i) { local[o] = i; });
    var st = {
      cap: pub.cap, n: alive.length, two: alive.length === 2, heatAt: pub.heatAt,
      total: pub.total, prev: pub.prev, dir: pub.dir, cur: local[pub.cur], over: -1, turn: pub.turn,
      shield: alive.map(function (o) { return !!(pub.shield || [])[o]; }),
      sealed: alive.map(function (o) { return !!(pub.sealed || [])[o]; }),
      skipDraw: alive.map(function (o) { return !!(pub.skipDraw || [])[o]; }),
      starSafe: alive.map(function (o) { return Number((pub.starSafe || [])[o] || 0); }),
      devil: alive.map(function (o) { return !!(pub.devil || [])[o]; }),
      force: pub.force < 0 ? -1 : local[pub.force],
      revealed: pub.revealed < 0 ? -1 : local[pub.revealed], revealedHand: {},
      pending: pub.pending ? { type: pub.pending.type, p: local[pub.pending.p] } : null,
      phase: pub.phase || "await_play",
      turnState: pub.turnState ? {
        p: local[pub.turnState.p], kind: pub.turnState.kind, played: pub.turnState.played, need: pub.turnState.need,
        sunChosen: !!pub.turnState.sunChosen,
        postDraw: (pub.turnState.postDraw || []).map(function (x) { return { type: x.type, target: local[x.target] }; })
      } : { p: local[pub.cur], kind: "normal", played: 0, need: 1, sunChosen: false, postDraw: [] },
      deck: snap.secret.deck, disc: snap.secret.disc,
      hands: alive.map(function (o) { return snap.hands[snap.uids[o]] || []; }), sunOptions: {}
    };
    Object.keys(pub.revealedHand || {}).forEach(function (k) { if (local[k] != null) st.revealedHand[local[k]] = pub.revealedHand[k]; });
    alive.forEach(function (o, i) {
      var u = snap.uids[o], prv = snap.private && snap.private[u];
      if (prv && (prv.sunOptions || (prv.pending && prv.pending.sunOptions))) st.sunOptions[i] = prv.sunOptions || prv.pending.sunOptions;
    });
    return st;
  }
  function privateMap(G, alive, uids, oldHands, oldPrivate) {
    var out = {};
    alive.forEach(function (orig, i) {
      var uid = uids[orig], hand = G.hands[i] || [], options = G.sunOptions[i];
      var pending = options && options.length ? { sunOptions: copy(options) } : null;
      var old = oldPrivate && oldPrivate[uid];
      if (JSON.stringify(oldHands[uid] || []) !== JSON.stringify(hand) || JSON.stringify(old && old.pending || null) !== JSON.stringify(pending)) {
        out[uid] = { hand: copy(hand), pending: pending };
      }
    });
    return out;
  }
  function removeFromState(st, idx, resetPile) {
    var s = copy(st), nOld = s.n, wasCur = s.cur === idx;
    s.disc = s.disc.concat(s.hands[idx]);
    ["hands", "shield", "sealed", "skipDraw", "starSafe", "devil"].forEach(function (k) { if (s[k]) s[k].splice(idx, 1); });
    s.n = nOld - 1; s.two = s.n === 2;
    if (wasCur) s.cur = s.dir === 1 ? idx % s.n : (idx - 1 + s.n) % s.n;
    else if (s.cur > idx) s.cur -= 1;
    if (s.force === idx) s.force = -1; else if (s.force > idx) s.force -= 1;
    if (s.revealed === idx) { s.revealed = -1; s.revealedHand = {}; }
    else if (s.revealed > idx) s.revealed -= 1;
    var rh = {}; Object.keys(s.revealedHand || {}).forEach(function (k) { var x = Number(k); if (x !== idx) rh[x > idx ? x - 1 : x] = s.revealedHand[k]; }); s.revealedHand = rh;
    // If the Sun chooser is forfeited, none of the revealed options was selected;
    // return all three cards to the bottom of the deck before removing private state.
    if (s.sunOptions && s.sunOptions[idx]) s.deck = s.deck.concat(s.sunOptions[idx]);
    var so = {}; Object.keys(s.sunOptions || {}).forEach(function (k) { var x = Number(k); if (x !== idx) so[x > idx ? x - 1 : x] = s.sunOptions[k]; }); s.sunOptions = so;
    var canceledPending = !!(s.pending && s.pending.p === idx);
    if (s.pending) { if (canceledPending) s.pending = null; else if (s.pending.p > idx) s.pending.p -= 1; }
    if (s.turnState) {
      if (s.turnState.p === idx) s.turnState.p = s.cur; else if (s.turnState.p > idx) s.turnState.p -= 1;
      s.turnState.postDraw = (s.turnState.postDraw || []).filter(function (x) { return x.target !== idx; }).map(function (x) { if (x.target > idx) x.target -= 1; return x; });
    }
    s.over = -1;
    if (resetPile || wasCur || canceledPending) {
      if (resetPile) { s.total = 0; s.prev = 0; s.turn = 0; s.force = -1; }
      s.pending = null; s.phase = "await_play";
      var devilTurn = !!s.devil[s.cur];
      if (devilTurn) s.devil[s.cur] = false;
      s.turnState = { p: s.cur, kind: devilTurn ? "devil" : "normal", played: 0,
        need: devilTurn ? Math.min(2, s.hands[s.cur].length) : 1, sunChosen: false, postDraw: [] };
    }
    return s;
  }
  function packEvent(orig, r, seq, alive) {
    return { seq: seq, p: orig, n: r.c ? r.c.n : null, id: r.c ? r.c.id : null,
      t: r.o ? r.o.t : (r.interrupt ? "Empress แทรกเทิร์น" : ""), before: r.before, after: r.after,
      heat: r.heat || 0, fx: r.fx || null, saved: !!r.saved, bust: !!r.bust,
      nx: r.nx != null && r.nx >= 0 ? (alive[r.nx] == null ? null : alive[r.nx]) : null,
      interrupt: !!r.interrupt, sealed: !!r.sealed, pending: r.pending ? r.pending.type : null };
  }
  function createResult(snap, G, meta, last, rnd, bustOrig) {
    var pub = snap.pub, alive = pub.alive, np = pub.np;
    if (bustOrig != null) {
      last.elim = bustOrig;
      return eliminate(snap, G, bustOrig, meta, true, rnd, last);
    }
    var npub = pubFrom(G, alive, np, meta), changed = privateMap(G, alive, snap.uids, snap.hands, snap.private);
    return { pub: npub, secret: { deck: G.deck, disc: G.disc }, private: changed, hands: Object.fromEntries(Object.keys(changed).map(function (u) { return [u, changed[u].hand]; })), cur: npub.cur, over: -1, elim: null, action: { last: last } };
  }
  function eliminate(snap, G, orig, meta, resetPile, rnd, last) {
    var pub = snap.pub, alive = pub.alive, np = pub.np, idx = alive.indexOf(orig);
    var st = G ? NN.exportState(G) : engineFrom(snap), out = pub.out.concat([orig]), changed = {};
    if (pub.mode === "elimination" && alive.length > 2) {
      var s2 = removeFromState(st, idx, resetPile), alive2 = alive.filter(function (o) { return o !== orig; });
      var G2 = NN.importState(s2, rnd);
      var np2 = pubFrom(G2, alive2, np, { mode: pub.mode, out: out, seq: meta.seq, turns: meta.turns,
        over: -1, winner: null, players: pub.players, last: last || meta.last, log: meta.log });
      alive2.forEach(function (o) { var i2 = alive2.indexOf(o), uid = snap.uids[o], opts = G2.sunOptions[i2];
        changed[uid] = { hand: copy(G2.hands[i2]), pending: opts && opts.length ? { sunOptions: copy(opts) } : null };
      });
      changed[snap.uids[orig]] = { hand: [], pending: null };
      return { pub: np2, secret: { deck: G2.deck, disc: G2.disc }, private: changed,
        hands: Object.fromEntries(Object.keys(changed).map(function (u) { return [u, changed[u].hand]; })), cur: np2.cur, over: -1, elim: orig,
        action: { p: orig, bust: true, last: last || meta.last } };
    }
    var GE = G || NN.importState(st), winner = null;
    if (pub.mode === "elimination") winner = alive.filter(function (o) { return o !== orig; })[0];
    var np3 = pubFrom(GE, alive, np, { mode: pub.mode, out: out, seq: meta.seq, turns: meta.turns,
      over: orig, winner: winner, players: pub.players, last: last || meta.last, log: meta.log });
    alive.forEach(function (o, i) {
      var uid = snap.uids[o], prv = snap.private && snap.private[uid];
      var hand = GE.hands[i] || [], pending = GE.sunOptions[i] ? { sunOptions: copy(GE.sunOptions[i]) } : null;
      if (JSON.stringify(snap.hands[uid] || []) !== JSON.stringify(hand) || JSON.stringify(prv && prv.pending || null) !== JSON.stringify(pending)) changed[uid] = { hand: copy(hand), pending: pending };
    });
    return { pub: np3, secret: { deck: GE.deck, disc: GE.disc }, private: changed,
      hands: Object.fromEntries(Object.keys(changed).map(function (u) { return [u, changed[u].hand]; })), cur: np3.cur, over: orig, elim: orig,
      action: { p: orig, bust: true, last: last || meta.last } };
  }
  function baseMeta(pub, last, log, seqIncrement, turns) {
    return { mode: pub.mode, out: pub.out, seq: pub.seq + (seqIncrement ? 1 : 0), turns: turns == null ? pub.turns : turns,
      over: -1, winner: null, players: pub.players, last: last || pub.last, log: log || pub.log || [] };
  }
  function applyPlay(snap, uid, cardId, rnd, choice) {
    var pub = snap.pub;
    if (!pub || pub.over >= 0) return { error: "game_over" };
    var orig = snap.uids.indexOf(uid);
    if (orig < 0) return { error: "not_in_game" };
    if (pub.alive.indexOf(orig) < 0) return { error: "eliminated" };
    if (pub.cur !== orig) return { error: "not_your_turn" };
    var mine = snap.hands[uid] || [], i = -1;
    for (var k = 0; k < mine.length; k++) if (mine[k].id === cardId) { i = k; break; }
    if (i < 0) return { error: "card_not_in_hand" };
    var G = NN.importState(engineFrom(snap), rnd), p = pub.alive.indexOf(orig);
    if (G.legal(p).indexOf(i) < 0) return { error: "illegal_card" };
    var localChoice = copy(choice || {});
    if (localChoice.target != null) { var targetLocal = pub.alive.indexOf(localChoice.target); if (targetLocal < 0) return { error: "bad_choice" }; localChoice.target = targetLocal; }
    var r = G.play(p, i, 0, localChoice); if (r.error) return r;
    var seq = pub.seq + 1, last = packEvent(orig, r, seq, pub.alive), log = (pub.log || []).concat([last]).slice(-LOG_MAX);
    var meta = baseMeta(pub, last, log, true, G.turn);
    var bust = r.bust ? orig : null;
    var res = createResult(snap, G, meta, last, rnd, bust);
    res.action = { p: orig, card_id: cardId, type: "play", last: last };
    return res;
  }
  function applyInterrupt(snap, uid, cardId, rnd) {
    var pub = snap.pub;
    if (!pub || pub.over >= 0) return { error: "game_over" };
    var orig = snap.uids.indexOf(uid);
    if (orig < 0) return { error: "not_in_game" };
    if (pub.alive.indexOf(orig) < 0) return { error: "eliminated" };
    var mine = snap.hands[uid] || [], i = -1;
    for (var k = 0; k < mine.length; k++) if (mine[k].id === cardId) { i = k; break; }
    if (i < 0) return { error: "card_not_in_hand" };
    var G = NN.importState(engineFrom(snap), rnd), p = pub.alive.indexOf(orig);
    var r = G.interrupt(p, i); if (r.error) return r;
    var seq = pub.seq + 1, last = packEvent(orig, r, seq, pub.alive), log = (pub.log || []).concat([last]).slice(-LOG_MAX);
    var meta = baseMeta(pub, last, log, true, G.turn);
    var res = createResult(snap, G, meta, last, rnd, r.bust ? orig : null);
    res.action = { p: orig, card_id: cardId, type: "interrupt", last: last };
    return res;
  }
  function applyChoose(snap, uid, index, rnd) {
    var pub = snap.pub, orig = snap.uids.indexOf(uid);
    if (!pub || pub.over >= 0) return { error: "game_over" };
    if (orig < 0 || pub.alive.indexOf(orig) < 0) return { error: "not_in_game" };
    var G = NN.importState(engineFrom(snap), rnd), p = pub.alive.indexOf(orig);
    var r = G.choose(p, { index: index }); if (r.error) return r;
    var meta = baseMeta(pub, pub.last, pub.log, true, G.turn);
    var npub = pubFrom(G, pub.alive, pub.np, meta), changed = privateMap(G, pub.alive, snap.uids, snap.hands, snap.private);
    return { pub: npub, secret: { deck: G.deck, disc: G.disc }, private: changed,
      hands: Object.fromEntries(Object.keys(changed).map(function (u) { return [u, changed[u].hand]; })), cur: npub.cur, over: -1,
      action: { p: orig, type: "choose_sun", index: index } };
  }
  function applySkip(snap, uid, rnd) {
    var pub = snap.pub, orig = snap.uids.indexOf(uid);
    if (!pub || pub.over >= 0) return { error: "game_over" };
    if (orig < 0 || pub.alive.indexOf(orig) < 0) return { error: "not_in_game" };
    var G = NN.importState(engineFrom(snap), rnd), p = pub.alive.indexOf(orig), r = G.skip(p);
    if (r.error) return r;
    var meta = baseMeta(pub, pub.last, pub.log, true, G.turn), npub = pubFrom(G, pub.alive, pub.np, meta);
    var changed = privateMap(G, pub.alive, snap.uids, snap.hands, snap.private);
    return { pub: npub, secret: { deck: G.deck, disc: G.disc }, private: changed,
      hands: Object.fromEntries(Object.keys(changed).map(function (u) { return [u, changed[u].hand]; })), cur: npub.cur, over: -1,
      action: { p: orig, type: "skip_chariot" } };
  }
  function applyForfeit(snap, orig, reason, rnd) {
    var pub = snap.pub;
    if (!pub || pub.over >= 0) return { error: "game_over" };
    if (pub.alive.indexOf(orig) < 0) return { error: "eliminated" };
    var last = { seq: pub.seq + 1, p: orig, n: null, id: null, t: "", before: pub.total, after: pub.total,
      heat: 0, fx: null, saved: false, bust: false, nx: null, forfeit: true, reason: reason, elim: orig };
    var log = (pub.log || []).concat([last]).slice(-LOG_MAX);
    var meta = baseMeta(pub, last, log, true, pub.turns), res = eliminate(snap, null, orig, meta, false, rnd, last);
    res.action = { p: orig, forfeit: true, reason: reason, last: last };
    return res;
  }
  function summary(pub) { return { loser: pub.over, winner: pub.winner, turns: pub.turns, total: pub.last ? pub.last.after : pub.total, cap: pub.cap, out: pub.out }; }
  return { startGame: startGame, applyPlay: applyPlay, applyInterrupt: applyInterrupt, applyChoose: applyChoose,
    applySkip: applySkip, applyForfeit: applyForfeit, summary: summary, copy: copy };
});

/* ===== online/nn-api-core.js ===== */
/* HRTA Number Ceiling — API orchestration. UID is always taken from the verified JWT. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./nn-server.js"));
  else root.NNApi = factory(root.NNServer);
})(typeof self !== "undefined" ? self : this, function (SV) {
  "use strict";
  var TURN_MS = 60000;
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function create(deps) {
    var admin = deps.admin, rnd = deps.rnd, now = deps.now || function () { return Date.now(); };
    var log = deps.log || function () {};
    async function q(promise) { var r = await promise; if (r.error) throw new Error("db: " + r.error.message); return r.data; }
    function deadline() { return new Date(now() + TURN_MS).toISOString(); }

    async function start(uid, b) {
      if (!UUID.test(String(b.room_id || ""))) return { error: "bad_request" };
      var room = await q(admin.from("rooms").select("*").eq("id", b.room_id).maybeSingle());
      if (!room) return { error: "room_not_found" };
      if (room.host_user_id !== uid) return { error: "not_host" };
      if (room.status !== "lobby") return { error: "room_started" };
      var ps = await q(admin.from("room_players").select("*").eq("room_id", room.id).is("left_at", null).order("seat"));
      if (ps.length < 2 || ps.length > 4) return { error: "bad_player_count" };
      if (ps.some(function (p) { return !p.is_ready; })) return { error: "not_all_ready" };
      var g = SV.startGame(ps.map(function (p) { return { user_id: p.user_id, seat: p.seat, name: p.player_name, avatar: p.avatar }; }), room.cap, rnd, room.mode);
      if (g.error) return { error: g.error };
      var res = await q(admin.rpc("nn_commit_start", {
        p_room: room.id, p_host: uid, p_public: g.pub, p_secret: g.secret, p_hands: g.hands,
        p_cur: g.cur, p_deadline: deadline()
      }));
      if (res && res.error) return { error: res.error };
      return { ok: true, game_id: res.game_id };
    }

    async function loadGame(uid, b) {
      if (!UUID.test(String(b.game_id || ""))) return { error: "bad_request" };
      var game = await q(admin.from("games").select("*").eq("id", b.game_id).maybeSingle());
      if (!game) return { error: "game_not_found" };
      var mem = await q(admin.from("room_players").select("user_id").eq("room_id", game.room_id).eq("user_id", uid).is("left_at", null));
      if (!mem.length) return { error: "not_in_game" };
      if (game.status !== "playing") return { state: "over", game: game };
      var sec = await q(admin.from("game_secrets").select("deck,disc").eq("game_id", game.id).maybeSingle());
      var rows = await q(admin.from("player_private_states").select("user_id,seat,hand,pending").eq("game_id", game.id));
      if (!sec || !rows.length) return { error: "game_not_found" };
      var pub = game.public_state, uids = [], hands = {}, privateStates = {};
      pub.players.slice().sort(function (a, b) { return a.p - b.p; }).forEach(function (pl, p) {
        var row = rows.filter(function (r) { return r.seat === pl.seat; })[0];
        uids[p] = row ? row.user_id : null;
      });
      if (uids.some(function (u) { return !u; })) return { error: "server_error" };
      rows.forEach(function (r) { hands[r.user_id] = r.hand; privateStates[r.user_id] = { hand: r.hand, pending: r.pending || null, sunOptions: r.pending && r.pending.sunOptions ? r.pending.sunOptions : null }; });
      return { game: game, uids: uids, hands: hands, private: privateStates, secret: sec };
    }

    async function mutate(uid, b, type, apply) {
      if (!UUID.test(String(b.game_id || "")) || !UUID.test(String(b.request_id || "")) || !Number.isInteger(b.expected_version)) return { error: "bad_request" };
      var L = await loadGame(uid, b); if (L.error || L.state) return L.error ? L : { error: "game_over" };
      var game = L.game;
      if (game.version !== b.expected_version) {
        var seen = await q(admin.from("game_actions").select("seq").eq("game_id", game.id).eq("request_id", b.request_id));
        if (seen.length) return { ok: true, dup: true, version: game.version };
        return { error: "stale", version: game.version };
      }
      var snap = { pub: game.public_state, secret: L.secret, hands: L.hands, private: L.private, uids: L.uids };
      var out = apply(snap);
      if (out.error) return out;
      var res = await q(admin.rpc("nn_commit_action", {
        p_game: game.id, p_expected: b.expected_version, p_user: uid, p_request: b.request_id,
        p_public: out.pub, p_secret: out.secret, p_hands: out.private || {}, p_cur: out.cur, p_over: out.over,
        p_deadline: out.over >= 0 ? null : deadline(), p_action: out.action || { type: type }, p_type: type
      }));
      if (res && res.error) return res.error === "stale" ? { error: "stale", version: res.version } : { error: res.error };
      return { ok: true, version: res.version, dup: !!res.dup };
    }

    async function play(uid, b) {
      if (!Number.isInteger(b.card_id) || (b.choice != null && (typeof b.choice !== "object" || Array.isArray(b.choice)))) return { error: "bad_request" };
      return mutate(uid, b, "play", function (snap) { return SV.applyPlay(snap, uid, b.card_id, rnd, b.choice || {}); });
    }
    async function interrupt(uid, b) {
      if (!Number.isInteger(b.card_id)) return { error: "bad_request" };
      return mutate(uid, b, "interrupt", function (snap) { return SV.applyInterrupt(snap, uid, b.card_id, rnd); });
    }
    async function choose(uid, b) {
      if (!Number.isInteger(b.index)) return { error: "bad_request" };
      return mutate(uid, b, "choose", function (snap) { return SV.applyChoose(snap, uid, b.index, rnd); });
    }
    async function skip(uid, b) {
      return mutate(uid, b, "skip", function (snap) { return SV.applySkip(snap, uid, rnd); });
    }

    /* ---- timeout / disconnect / leaving: same elimination path as Phase 3 ---- */
    var HB_FRESH_MS = 45000, RECONNECT_MS = 120000;
    async function forfeitPlayer(L, orig, reason, caller) {
      var game = L.game;
      var snap = { pub: game.public_state, secret: L.secret, hands: L.hands, private: L.private, uids: L.uids };
      var out = SV.applyForfeit(snap, orig, reason, rnd);
      if (out.error === "eliminated") return { ok: true, state: "out" };
      if (out.error) return { error: out.error };
      var uuid = deps.uuid ? deps.uuid() : (globalThis.crypto && globalThis.crypto.randomUUID ? globalThis.crypto.randomUUID() : null);
      if (!uuid) return { error: "server_error" };
      var res = await q(admin.rpc("nn_commit_action", {
        p_game: game.id, p_expected: game.version, p_user: caller, p_request: uuid,
        p_public: out.pub, p_secret: out.secret, p_hands: out.private || {}, p_cur: out.cur, p_over: out.over,
        p_deadline: out.over >= 0 ? null : deadline(), p_action: out.action, p_type: "forfeit"
      }));
      if (res && res.error === "stale") return { ok: true, state: "stale" };
      if (res && res.error === "game_over") return { ok: true, state: "over" };
      if (res && res.error) return { error: res.error };
      return { ok: true, state: out.over >= 0 ? "forfeited" : "eliminated", loser: orig, reason: reason, over: out.over >= 0 };
    }
    async function check(uid, b) {
      var L = await loadGame(uid, b); if (L.error || L.state) return L.error ? L : { ok: true, state: "over" };
      var game = L.game, pub = game.public_state, curUid = L.uids[pub.cur];
      var hb = await q(admin.from("player_heartbeats").select("user_id,last_seen_at").eq("room_id", game.room_id).eq("user_id", curUid));
      var seen = hb.length ? Date.parse(hb[0].last_seen_at) : (Date.parse(game.updated_at || game.created_at) || 0);
      var t = now(), dl = Date.parse(game.turn_deadline_at) || 0, connected = (t - seen) <= HB_FRESH_MS;
      var eff = connected ? dl : Math.max(dl, seen + RECONNECT_MS);
      if (t <= eff) return { ok: true, state: "waiting", remaining_ms: eff - t, connected: connected };
      return await forfeitPlayer(L, pub.cur, connected ? "timeout" : "disconnected", uid);
    }
    async function forfeit(uid, b) {
      var L = await loadGame(uid, b); if (L.error || L.state) return L.error ? L : { ok: true, state: "over" };
      var p = L.uids.indexOf(uid); if (p < 0) return { error: "not_in_game" };
      return forfeitPlayer(L, p, "left", uid);
    }
    async function handle(uid, body) {
      try {
        if (!uid || !body || typeof body !== "object") return { error: "bad_request" };
        if (body.action === "start") return await start(uid, body);
        if (body.action === "play") return await play(uid, body);
        if (body.action === "interrupt") return await interrupt(uid, body);
        if (body.action === "choose") return await choose(uid, body);
        if (body.action === "skip") return await skip(uid, body);
        if (body.action === "check") return await check(uid, body);
        if (body.action === "forfeit") return await forfeit(uid, body);
        return { error: "bad_action" };
      } catch (e) { log("nn-api error", e && e.message); return { error: "server_error" }; }
    }
    return { handle: handle };
  }
  return { create: create, TURN_MS: TURN_MS };
});


// ---------- ส่วนที่ผูกกับ Supabase/Deno ----------
const ALLOWED = (Deno.env.get("ALLOWED_ORIGINS") || "https://monogizmo.github.io").split(",").map((s) => s.trim());
const SB_URL = Deno.env.get("SUPABASE_URL");
// service_role อยู่ในสภาพแวดล้อมของ Edge Function เท่านั้น (ไม่เคยอยู่ในโค้ด/ GitHub)
const SB_KEY = Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const admin = createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

// ตัวสุ่มปลอดภัย 53 บิต ช่วง [0,1)
function rnd() {
  const b = new Uint32Array(2);
  crypto.getRandomValues(b);
  return (b[0] * 2097152 + (b[1] >>> 11)) / 9007199254740992;
}
const api = globalThis.NNApi.create({ admin, rnd, log: (...a) => console.error(...a) });

function corsHeaders(req) {
  const o = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED.includes(o) ? o : ALLOWED[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

Deno.serve(async (req) => {
  const h = corsHeaders(req);
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...h, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return json({ error: "bad_request" }, 405);

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "not_authenticated" }, 401);
  const { data, error } = await admin.auth.getUser(token);      // ตรวจ JWT จริง ไม่เชื่อ user id จาก body
  if (error || !data || !data.user) return json({ error: "not_authenticated" }, 401);

  let body;
  try { body = await req.json(); } catch (_) { return json({ error: "bad_request" }, 400); }
  const out = await api.handle(data.user.id, body);
  return json(out, out.error === "server_error" ? 500 : 200);
});
