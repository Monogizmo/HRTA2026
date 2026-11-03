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
