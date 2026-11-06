/* HRTA Number Ceiling — ตรรกะฝั่งเซิร์ฟเวอร์ (ฟังก์ชันล้วน ไม่แตะ DB/เครือข่าย จึงทดสอบบน Node ได้)
 * ใช้โดย Supabase Edge Function `nn-api` เท่านั้น  ตัวสุ่ม rnd ต้องมาจากเซิร์ฟเวอร์ (crypto)
 * ข้อมูลแบ่ง 3 ชั้น:  pub = สาธารณะ (ทุกคนในห้องเห็น) · hands/extras = ของผู้เล่นแต่ละคน (เห็นเฉพาะเจ้าของ) · secret = สำรับ/กองทิ้ง/ไพ่ที่รอเลือก (ไม่มีใครเห็น)
 *
 * ดัชนีผู้เล่นใน pub ทุกช่อง เป็น "ดัชนีเดิมตอนเริ่มเกม" ซึ่งคงที่ตลอดเกม ส่วน engine ใช้ดัชนี 0..n-1 ของ "ผู้เล่นที่ยังอยู่" (pub.alive)
 * แปลงที่ขอบของ pubFrom/engineFrom เท่านั้น
 * action ที่รองรับ: play (card_id, k, tg) · pass (ข้ามการลงเพิ่มของ Chariot) · swap (เลือกไพ่ที่จะทิ้งของ Moon) · interject (Empress แทรกเทิร์น) · forfeit
 * โหมด one_loser: alive = ทุกคนตลอดเกม · โหมด elimination: ตกรอบแล้วกองรีเซ็ตเป็น 0 เล่นต่อจนเหลือ 1 คน
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./nn-engine.js"));
  else root.NNServer = factory(root.NNEngine);
})(typeof self !== "undefined" ? self : this, function (NN) {
  "use strict";
  var LOG_MAX = 8;

  function copy(x) { return JSON.parse(JSON.stringify(x)); }
  function range(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); return a; }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  // สร้างสถานะสาธารณะจาก engine (G เรียงตาม alive) ; np = จำนวนผู้เล่นเดิมทั้งหมด
  function pubFrom(G, alive, np, meta) {
    var shield = [], seal = [], owe = [], calm = [], hc = [];
    for (var o = 0; o < np; o++) { shield.push(false); seal.push(false); owe.push(false); calm.push(0); hc.push(0); }
    var rev = [];
    alive.forEach(function (orig, i) {
      shield[orig] = !!G.shield[i]; seal[orig] = !!G.seal[i]; owe[orig] = !!G.owe[i]; calm[orig] = G.calm[i] || 0; hc[orig] = G.hands[i].length;
      if (G.rev[i]) rev.push({ p: orig, hand: G.hands[i] });
    });
    var seq = null;
    if (G.seq) {
      seq = { p: alive[G.seq.p], plays: G.seq.plays, max: G.seq.max, forced: G.seq.forced, opt: G.seq.opt, sun: G.seq.sun, moon: !!G.seq.moon, owed: G.seq.owed,
        post: G.seq.post.map(function (e) { return e.fx === "swap" ? { fx: "swap", a: alive[e.a], b: alive[e.b] } : { fx: "devil", q: alive[e.q] }; }) };
    }
    return {
      v: 3, mode: meta.mode, np: np, alive: alive.slice(), out: meta.out.slice(),
      cap: G.cap, n: G.n, heatAt: G.heatAt, hb: G.hb || 0,
      total: G.total, prev: G.prev, dir: G.dir, cur: alive[G.cur], turn: G.turn, heat: G.heat(),
      seq_n: meta.seq, turns: meta.turns,
      shield: shield, seal: seal, owe: owe, calm: calm, rev: rev, seq: seq,
      pend: G.pend ? { t: G.pend.t, p: alive[G.pend.p] } : null,
      dbl: G.dbl ? { p: alive[G.dbl.p], left: G.dbl.left } : null,
      force: G.force < 0 ? -1 : alive[G.force], over: meta.over, winner: meta.winner,
      handCounts: hc, players: meta.players, last: meta.last || null, log: meta.log || []
    };
  }

  /* เริ่มเกม: players = [{user_id, seat, name, avatar}] (2–4 คน) ; ดัชนีเดิม = ลำดับที่นั่งจากน้อยไปมาก */
  function startGame(players, cap, rnd, mode) {
    mode = mode || "one_loser";
    var ps = players.slice().sort(function (a, b) { return a.seat - b.seat; });
    var n = ps.length;
    if (n < 2 || n > 4) return { error: "bad_player_count" };
    if ([120, 150, 200].indexOf(cap) < 0) return { error: "bad_cap" };
    if (mode !== "one_loser" && mode !== "elimination") return { error: "bad_mode" };
    var G = NN.engine({ cap: cap, n: n }, rnd);
    G.deal();
    G.cur = Math.floor(rnd() * n);                       // สุ่มคนเริ่ม (ฝั่งเซิร์ฟเวอร์)
    var pl = ps.map(function (x, p) { return { p: p, seat: x.seat, name: x.name, avatar: x.avatar }; });
    var hands = {};
    ps.forEach(function (x, p) { hands[x.user_id] = G.hands[p]; });
    return {
      pub: pubFrom(G, range(n), n, { mode: mode, out: [], seq: 0, turns: 0, over: -1, winner: null, players: pl, last: null, log: [] }),
      secret: { deck: G.deck, disc: G.disc, pend: null },
      hands: hands,
      uids: ps.map(function (x) { return x.user_id; }),
      cur: G.cur
    };
  }

  // สร้างสถานะ engine จากสถานะสาธารณะ + สำรับลับ + มือ (เรียงตาม pub.alive)
  function engineFrom(snap) {
    var pub = snap.pub, alive = pub.alive, inv = function (o) { return alive.indexOf(o); };
    var pick = function (arr) { return alive.map(function (o) { return arr[o]; }); };
    var rev = alive.map(function (o) { return (pub.rev || []).some(function (r) { return r.p === o; }); });
    var st = {
      cap: pub.cap, n: alive.length, two: alive.length === 2, heatAt: pub.heatAt, hb: pub.hb || 0, total: pub.total, prev: pub.prev,
      dir: pub.dir, cur: inv(pub.cur), over: -1, turn: pub.turn,
      shield: pick(pub.shield).map(Boolean), seal: pick(pub.seal).map(Boolean), owe: pick(pub.owe).map(Boolean), calm: pick(pub.calm).map(function (x) { return x || 0; }), rev: rev,
      dbl: pub.dbl ? { p: inv(pub.dbl.p), left: pub.dbl.left } : null,
      force: pub.force < 0 ? -1 : inv(pub.force),
      seq: null, pend: null,
      deck: snap.secret.deck, disc: snap.secret.disc,
      hands: alive.map(function (o) { return snap.hands[snap.uids[o]]; })
    };
    if (pub.seq) {
      st.seq = { p: inv(pub.seq.p), plays: pub.seq.plays, max: pub.seq.max, forced: pub.seq.forced, opt: pub.seq.opt, sun: pub.seq.sun, moon: !!pub.seq.moon, owed: pub.seq.owed,
        post: pub.seq.post.map(function (e) { return e.fx === "swap" ? { fx: "swap", a: inv(e.a), b: inv(e.b) } : { fx: "devil", q: inv(e.q) }; }) };
    }
    if (pub.pend) {
      st.pend = { t: pub.pend.t, p: inv(pub.pend.p) };
      if (pub.pend.t === "pick") st.pend.cards = (snap.secret.pend || []).slice();
    }
    return st;
  }

  // เอาผู้เล่นออกจากสถานะ engine (st เรียงตาม alive เดิม)  resetPile = กองรีเซ็ตเป็น 0 (กรณีทำกองเกิน)
  function removeFromState(st, idx, resetPile) {
    var s = copy(st), nOld = s.n, wasCur = s.cur === idx;
    if (s.pend && s.pend.cards) s.deck = s.deck.concat(s.pend.cards);          // ไพ่ที่รอเลือกกลับไปใต้กอง
    s.disc = s.disc.concat(s.hands[idx]);
    ["hands", "shield", "seal", "owe", "calm", "rev"].forEach(function (k) { s[k].splice(idx, 1); });
    s.n = nOld - 1; s.two = s.n === 2;
    if (wasCur) s.cur = s.dir === 1 ? idx % s.n : (idx - 1 + s.n) % s.n;
    else if (s.cur > idx) s.cur -= 1;
    if (s.force === idx) s.force = -1; else if (s.force > idx) s.force -= 1;
    if (s.dbl) { if (s.dbl.p === idx) s.dbl = null; else if (s.dbl.p > idx) s.dbl.p -= 1; }
    s.seq = null; s.pend = null; s.over = -1;                                   // ตาที่ค้างอยู่ถูกยกเลิก
    if (resetPile) { s.total = 0; s.prev = 0; s.turn = 0; s.dbl = null; s.force = -1; }
    return s;
  }

  /* ผู้เล่น orig ตกรอบ/แพ้ ด้วยเหตุผล (bust | timeout | disconnected | left)
   * ใช้ทั้งตอนลงไพ่แล้วเกิน (G = engine หลังลง) และตอนยอมแพ้ (G = null)
   * คืน { pub, secret, hands(เฉพาะที่เปลี่ยน), extras, cur, over, elim } */
  function eliminate(snap, G, orig, meta, resetPile, rnd) {
    var pub = snap.pub, alive = pub.alive, np = pub.np;
    var idx = alive.indexOf(orig);
    var st = G ? NN.exportState(G) : engineFrom(snap);
    var out = pub.out.concat([orig]);
    var changed = {}, extras = {};
    if (snap.extras) alive.forEach(function (o) { var u = snap.uids[o]; if (snap.extras[u]) extras[u] = null; });   // ล้างไพ่ที่รอเลือกเดิม
    if (pub.mode === "elimination" && alive.length > 2) {
      var s2 = removeFromState(st, idx, resetPile);
      var alive2 = alive.filter(function (o) { return o !== orig; });
      var G2 = NN.importState(s2, rnd);
      var np2 = pubFrom(G2, alive2, np, {
        mode: pub.mode, out: out, seq: meta.seq, turns: meta.turns, over: -1, winner: null,
        players: pub.players, last: meta.last, log: meta.log
      });
      alive.forEach(function (o) {
        var uid = snap.uids[o];
        var nh = o === orig ? [] : G2.hands[alive2.indexOf(o)];
        if (!same(snap.hands[uid], nh)) changed[uid] = nh;
      });
      return { pub: np2, secret: { deck: G2.deck, disc: G2.disc, pend: null }, hands: changed, extras: extras, cur: np2.cur, over: -1, elim: orig };
    }
    // จบเกม: โหมดเดี่ยว = ผู้แพ้ 1 คน ; โหมดคัดออกเหลือ 2 คน = อีกคนชนะ
    var GE = G || NN.importState(st, rnd);
    if (!G && GE.pend && GE.pend.cards) { GE.deck = GE.deck.concat(GE.pend.cards); }
    GE.seq = null; GE.pend = null;
    var winner = null;
    if (pub.mode === "elimination") winner = alive.filter(function (o) { return o !== orig; })[0];
    var np3 = pubFrom(GE, alive, np, {
      mode: pub.mode, out: out, seq: meta.seq, turns: meta.turns, over: orig, winner: winner,
      players: pub.players, last: meta.last, log: meta.log
    });
    alive.forEach(function (o, i) {
      var uid = snap.uids[o];
      if (!same(snap.hands[uid], GE.hands[i])) changed[uid] = GE.hands[i];
    });
    return { pub: np3, secret: { deck: GE.deck, disc: GE.disc, pend: null }, hands: changed, extras: extras, cur: np3.cur, over: orig, elim: orig };
  }

  // ผลหลังเรียก engine (ลง/ข้าม/เลือก/แทรก) ที่ไม่ใช่การแพ้ → สร้างผลลัพธ์ทั้งหมด
  function finish(snap, G, last, kind) {
    var pub = snap.pub, alive = pub.alive;
    var log = (pub.log || []).concat([last]).slice(-LOG_MAX);
    var meta = { mode: pub.mode, out: pub.out, seq: pub.seq_n + 1, turns: pub.turns + (kind === "play" || kind === "interject" ? 1 : 0), over: -1, winner: null, players: pub.players, last: last, log: log };
    var npub = pubFrom(G, alive, pub.np, meta);
    var changed = {}, extras = {};
    alive.forEach(function (o, q) {
      var u = snap.uids[o];
      if (!same(snap.hands[u], G.hands[q])) changed[u] = G.hands[q];
      var had = snap.extras && snap.extras[u];
      var want = (G.pend && G.pend.t === "pick" && G.pend.p === q) ? { pick: G.pend.cards } : null;
      if (want) extras[u] = want; else if (had) extras[u] = null;
    });
    return { pub: npub, secret: { deck: G.deck, disc: G.disc, pend: G.pend && G.pend.cards ? G.pend.cards : null }, hands: changed, extras: extras, cur: npub.cur, over: -1, elim: null, meta: meta };
  }
  function bustResult(snap, G, orig, last, kind, rnd) {
    var pub = snap.pub, log = (pub.log || []).concat([last]).slice(-LOG_MAX);
    last.elim = orig;
    var meta = { mode: pub.mode, out: pub.out, seq: pub.seq_n + 1, turns: pub.turns + 1, over: -1, winner: null, players: pub.players, last: last, log: log };
    return eliminate(snap, G, orig, meta, true, rnd);
  }
  function lastFrom(pub, orig, r, alive, kind) {
    return {
      seq: pub.seq_n, kind: kind, p: orig, n: r.c.n, id: r.c.id, t: r.o.t, before: r.before, after: r.after,
      heat: r.heat, fx: r.fx, saved: r.saved, bust: r.bust, sealed: !!r.sealed,
      nx: (r.nx != null && r.nx >= 0) ? alive[r.nx] : r.nx, tg: (r.tg != null && r.tg >= 0) ? alive[r.tg] : null
    };
  }

  // ตรวจว่าใครเป็นผู้ลงได้: ถ้ามี pend → คนใน pend ; ไม่งั้น cur
  function actor(pub) { return pub.pend ? pub.pend.p : pub.cur; }
  function baseCheck(snap, uid) {
    var pub = snap.pub;
    if (!pub || pub.over >= 0) return { error: "game_over" };
    var orig = snap.uids.indexOf(uid);
    if (orig < 0) return { error: "not_in_game" };
    if (pub.alive.indexOf(orig) < 0) return { error: "eliminated" };
    return { orig: orig };
  }

  /* ลงไพ่ 1 ใบ  opt = { k, tg }  (tg เป็นดัชนีเดิมของผู้เล่นเป้าหมายสำหรับ Fool/Emperor/Moon) */
  function applyPlay(snap, uid, cardId, rnd, opt) {
    opt = opt || {};
    var c0 = baseCheck(snap, uid); if (c0.error) return c0;
    var pub = snap.pub, orig = c0.orig, alive = pub.alive;
    if (pub.pend && pub.pend.t === "moon") return { error: pub.pend.p === orig ? "must_swap" : "not_your_turn" };
    if (actor(pub) !== orig) return { error: "not_your_turn" };
    var mine = snap.hands[uid] || [];
    var i = -1;
    for (var k = 0; k < mine.length; k++) if (mine[k].id === cardId) { i = k; break; }
    if (i < 0) return { error: "card_not_in_hand" };

    var p = alive.indexOf(orig);
    var G = NN.importState(engineFrom(snap), rnd);
    if (G.legal(p).indexOf(i) < 0) return { error: "illegal_card" };
    var kk = opt.k == null ? 0 : opt.k, card = mine[i];
    var sealed = !!G.seal[p], os = sealed ? [{ fx: "" }] : G.opts(card.n);
    if (!(kk >= 0 && kk < os.length && kk === Math.floor(kk))) return { error: "bad_option" };
    var tgIdx = null;
    if (!sealed && G.needsTarget(os[kk].fx) && alive.length > 2) {
      tgIdx = alive.indexOf(opt.tg);
      if (tgIdx < 0 || tgIdx === p) return { error: "need_target" };
    }
    var r = G.play(p, i, kk, tgIdx == null ? undefined : tgIdx);
    var last = lastFrom(pub, orig, r, alive, "play");
    if (r.bust) { var b = bustResult(snap, G, orig, last, "play", rnd); b.action = { p: orig, card_id: cardId, last: last }; return b; }
    var res = finish(snap, G, last, "play");
    res.action = { p: orig, card_id: cardId, k: kk, tg: opt.tg == null ? null : opt.tg, last: last };
    return res;
  }

  // ข้ามการลงเพิ่มของ Chariot
  function applyPass(snap, uid, rnd) {
    var c0 = baseCheck(snap, uid); if (c0.error) return c0;
    var pub = snap.pub, orig = c0.orig;
    if (!pub.pend || pub.pend.t !== "extra") return { error: "no_pending" };
    if (pub.pend.p !== orig) return { error: "not_your_turn" };
    var G = NN.importState(engineFrom(snap), rnd), p = pub.alive.indexOf(orig);
    if (!G.pass(p)) return { error: "no_pending" };
    var last = { seq: pub.seq_n, kind: "pass", p: orig, n: null, id: null, t: "", before: pub.total, after: pub.total, heat: 0, fx: null, saved: false, bust: false };
    var res = finish(snap, G, last, "pass"); res.action = { p: orig, pass: true, last: last }; return res;
  }

  // The Moon: เลือกไพ่ในมือที่จะทิ้งกี่ใบก็ได้ (ix = ดัชนีในมือ ไม่ซ้ำ) แล้วจั่วใหม่เท่าจำนวนที่ทิ้ง
  function applySwap(snap, uid, ix, rnd) {
    var c0 = baseCheck(snap, uid); if (c0.error) return c0;
    var pub = snap.pub, orig = c0.orig;
    if (!pub.pend || pub.pend.t !== "moon") return { error: "no_pending" };
    if (pub.pend.p !== orig) return { error: "not_your_turn" };
    var G = NN.importState(engineFrom(snap), rnd), p = pub.alive.indexOf(orig);
    if (!Array.isArray(ix) || ix.length > 12) return { error: "bad_option" };
    var seen = {}, hl = G.hands[p].length;
    for (var j = 0; j < ix.length; j++) {
      if (!Number.isInteger(ix[j]) || ix[j] < 0 || ix[j] >= hl || seen[ix[j]]) return { error: "bad_option" };
      seen[ix[j]] = 1;
    }
    var r = G.swap(p, ix);
    if (!r) return { error: "no_pending" };
    var last = { seq: pub.seq_n, kind: "swap", p: orig, n: null, id: null, t: "", k: r.k, before: pub.total, after: pub.total, heat: 0, fx: null, saved: false, bust: false };
    var res = finish(snap, G, last, "swap"); res.action = { p: orig, swap: r.k, last: last }; return res;
  }

  // The Empress แทรกเทิร์น (ผู้เล่นที่ไม่ใช่ตาของตัวเอง)
  function applyInterject(snap, uid, rnd) {
    var c0 = baseCheck(snap, uid); if (c0.error) return c0;
    var pub = snap.pub, orig = c0.orig, alive = pub.alive;
    var G = NN.importState(engineFrom(snap), rnd), p = alive.indexOf(orig);
    if (G.canInterject(p) < 0) return { error: "cant_interject" };
    var r = G.interject(p);
    var last = lastFrom(pub, orig, r, alive, "interject"); last.interject = true;
    if (r.bust) { var b = bustResult(snap, G, orig, last, "interject", rnd); b.action = { p: orig, interject: true, last: last }; return b; }
    var res = finish(snap, G, last, "interject"); res.action = { p: orig, interject: true, last: last }; return res;
  }

  /* ยอมแพ้ (หมดเวลา/หลุด/ออก) = ตกรอบ ; ถ้าเป็นโหมดเดี่ยวหรือเหลือ 2 คน = เกมจบ */
  function applyForfeit(snap, orig, reason, rnd) {
    var pub = snap.pub;
    if (!pub || pub.over >= 0) return { error: "game_over" };
    if (pub.alive.indexOf(orig) < 0) return { error: "eliminated" };
    var last = { seq: pub.seq_n, kind: "forfeit", p: orig, n: null, id: null, t: "", before: pub.total, after: pub.total, heat: 0, fx: null, saved: false, bust: false, forfeit: true, reason: reason, elim: orig };
    var log = (pub.log || []).concat([last]).slice(-LOG_MAX);
    var meta = { mode: pub.mode, out: pub.out, seq: pub.seq_n + 1, turns: pub.turns, over: -1, winner: null, players: pub.players, last: last, log: log };
    var res = eliminate(snap, null, orig, meta, false, rnd);
    res.action = { p: orig, forfeit: true, reason: reason, last: last };
    return res;
  }

  function summary(pub) {
    return { loser: pub.over, winner: pub.winner, turns: pub.turns, total: pub.last ? pub.last.after : pub.total, cap: pub.cap, out: pub.out };
  }

  return { startGame: startGame, applyPlay: applyPlay, applyPass: applyPass, applySwap: applySwap, applyInterject: applyInterject, applyForfeit: applyForfeit, summary: summary, copy: copy };
});
