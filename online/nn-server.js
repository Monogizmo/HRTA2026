/* HRTA Number Ceiling — ตรรกะฝั่งเซิร์ฟเวอร์ (ฟังก์ชันล้วน ไม่แตะ DB/เครือข่าย จึงทดสอบบน Node ได้)
 * ใช้โดย Supabase Edge Function `nn-api` เท่านั้น  ตัวสุ่ม rnd ต้องมาจากเซิร์ฟเวอร์ (crypto)
 * ข้อมูลแบ่ง 3 ชั้น:  pub = สาธารณะ (ทุกคนในห้องเห็น) · hands = มือของแต่ละคน (เห็นเฉพาะเจ้าของ) · secret = สำรับ/กองทิ้ง (ไม่มีใครเห็น)
 *
 * ดัชนีผู้เล่นใน pub ทุกช่อง (cur, shield, force, dbl.p, handCounts, last.p/nx, over, winner, out, alive) เป็น "ดัชนีเดิมตอนเริ่มเกม"
 * ซึ่งคงที่ตลอดเกม ส่วน engine ใช้ดัชนี 0..n-1 ของ "ผู้เล่นที่ยังอยู่" (pub.alive) — แปลงที่ขอบของ applyPlay/removePlayer เท่านั้น
 * โหมด one_loser: alive = ทุกคนตลอดเกม (พฤติกรรมเหมือนเดิมทุกอย่าง)
 * โหมด elimination: ใครทำกองเกิน (หรือหมดเวลา/ออก) = ตกรอบ กองรีเซ็ตเป็น 0 เล่นต่อจนเหลือ 1 คน (ผู้ชนะ)
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./nn-engine.js"));
  else root.NNServer = factory(root.NNEngine);
})(typeof self !== "undefined" ? self : this, function (NN) {
  "use strict";
  var LOG_MAX = 8;

  function copy(x) { return JSON.parse(JSON.stringify(x)); }
  function range(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); return a; }

  // สร้างสถานะสาธารณะจาก engine (G เรียงตาม alive) ; np = จำนวนผู้เล่นเดิมทั้งหมด
  function pubFrom(G, alive, np, meta) {
    var shield = [], hc = [];
    for (var o = 0; o < np; o++) { shield.push(false); hc.push(0); }
    alive.forEach(function (orig, i) { shield[orig] = !!G.shield[i]; hc[orig] = G.hands[i].length; });
    return {
      v: 2, mode: meta.mode, np: np, alive: alive.slice(), out: meta.out.slice(),
      cap: G.cap, n: G.n, two: G.two, heatAt: G.heatAt,
      total: G.total, prev: G.prev, dir: G.dir, cur: alive[G.cur], turn: G.turn, heat: G.heat(),
      seq: meta.seq, turns: meta.turns,
      shield: shield, dbl: G.dbl ? { p: alive[G.dbl.p], left: G.dbl.left } : null,
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
      secret: { deck: G.deck, disc: G.disc },
      hands: hands,
      uids: ps.map(function (x) { return x.user_id; }),
      cur: G.cur
    };
  }

  // สร้าง engine จากสถานะสาธารณะ + สำรับลับ + มือ (เรียงตาม pub.alive)
  function engineFrom(snap) {
    var pub = snap.pub, alive = pub.alive;
    var st = {
      cap: pub.cap, n: alive.length, two: alive.length === 2, heatAt: pub.heatAt, total: pub.total, prev: pub.prev,
      dir: pub.dir, cur: alive.indexOf(pub.cur), over: -1, turn: pub.turn,
      shield: alive.map(function (o) { return !!pub.shield[o]; }),
      dbl: pub.dbl ? { p: alive.indexOf(pub.dbl.p), left: pub.dbl.left } : null,
      force: pub.force < 0 ? -1 : alive.indexOf(pub.force),
      deck: snap.secret.deck, disc: snap.secret.disc,
      hands: alive.map(function (o) { return snap.hands[snap.uids[o]]; })
    };
    return st;
  }

  // เอาผู้เล่นออกจากสถานะ engine (st = engine state ตามลำดับ alive เดิม)  resetPile = กองรีเซ็ตเป็น 0 (กรณีทำกองเกิน)
  function removeFromState(st, idx, resetPile) {
    var s = copy(st), nOld = s.n, wasCur = s.cur === idx;
    s.disc = s.disc.concat(s.hands[idx]);
    s.hands.splice(idx, 1); s.shield.splice(idx, 1);
    s.n = nOld - 1; s.two = s.n === 2;
    if (wasCur) s.cur = s.dir === 1 ? idx % s.n : (idx - 1 + s.n) % s.n;
    else if (s.cur > idx) s.cur -= 1;
    if (s.force === idx) s.force = -1; else if (s.force > idx) s.force -= 1;
    if (s.dbl) { if (s.dbl.p === idx) s.dbl = null; else if (s.dbl.p > idx) s.dbl.p -= 1; }
    s.over = -1;
    if (resetPile) { s.total = 0; s.prev = 0; s.turn = 0; s.dbl = null; s.force = -1; }
    return s;
  }

  /* ผู้เล่น orig ตกรอบ/แพ้ ด้วยเหตุผล (bust | timeout | disconnected | left)
   * ใช้ทั้งตอนลงไพ่แล้วเกิน (afterPlay=true: state ผ่านการลงแล้ว) และตอนยอมแพ้ (afterPlay=false)
   * คืน { pub, secret, hands(เฉพาะที่เปลี่ยน), cur, over, elim } */
  function eliminate(snap, G, orig, meta, resetPile, rnd) {
    var pub = snap.pub, alive = pub.alive, np = pub.np;
    var idx = alive.indexOf(orig);
    var st = G ? NN.exportState(G) : engineFrom(snap);
    var out = pub.out.concat([orig]);
    var changed = {};
    if (pub.mode === "elimination" && alive.length > 2) {
      var s2 = removeFromState(st, idx, resetPile);
      var alive2 = alive.filter(function (o) { return o !== orig; });
      var G2 = NN.importState(s2, rnd);
      var np2 = pubFrom(G2, alive2, np, {
        mode: pub.mode, out: out, seq: meta.seq, turns: meta.turns, over: -1, winner: null,
        players: pub.players, last: meta.last, log: meta.log
      });
      alive.forEach(function (o, i) {                    // มือของคนที่ยังอยู่ (อาจเปลี่ยนจากการลงไพ่) + ล้างมือคนตกรอบ
        var uid = snap.uids[o];
        var nh = o === orig ? [] : G2.hands[alive2.indexOf(o)];
        if (JSON.stringify(snap.hands[uid]) !== JSON.stringify(nh)) changed[uid] = nh;
      });
      return { pub: np2, secret: { deck: G2.deck, disc: G2.disc }, hands: changed, cur: np2.cur, over: -1, elim: orig };
    }
    // จบเกม: โหมดเดี่ยว = ผู้แพ้ 1 คน ; โหมดคัดออกเหลือ 2 คน = อีกคนชนะ
    var GE = G || NN.importState(st, rnd);
    var winner = null;
    if (pub.mode === "elimination") winner = alive.filter(function (o) { return o !== orig; })[0];
    var np3 = pubFrom(GE, alive, np, {
      mode: pub.mode, out: out, seq: meta.seq, turns: meta.turns, over: orig, winner: winner,
      players: pub.players, last: meta.last, log: meta.log
    });
    alive.forEach(function (o, i) {
      var uid = snap.uids[o];
      if (JSON.stringify(snap.hands[uid]) !== JSON.stringify(GE.hands[i])) changed[uid] = GE.hands[i];
    });
    return { pub: np3, secret: { deck: GE.deck, disc: GE.disc }, hands: changed, cur: np3.cur, over: orig, elim: orig };
  }

  /* ลงไพ่ 1 ใบ
   * snap = { pub, secret:{deck,disc}, hands:{uid:[card]}, uids:[uid ตามดัชนีเดิม] }
   * คืน { error } หรือ { pub, secret, hands(เฉพาะที่เปลี่ยน), cur, over, action } */
  function applyPlay(snap, uid, cardId, rnd) {
    var pub = snap.pub;
    if (!pub || pub.over >= 0) return { error: "game_over" };
    var orig = snap.uids.indexOf(uid);
    if (orig < 0) return { error: "not_in_game" };
    if (pub.alive.indexOf(orig) < 0) return { error: "eliminated" };
    if (pub.cur !== orig) return { error: "not_your_turn" };
    var mine = snap.hands[uid] || [];
    var i = -1;
    for (var k = 0; k < mine.length; k++) if (mine[k].id === cardId) { i = k; break; }
    if (i < 0) return { error: "card_not_in_hand" };

    var alive = pub.alive, p = alive.indexOf(orig);
    var G = NN.importState(engineFrom(snap), rnd);
    if (G.legal(p).indexOf(i) < 0) return { error: "illegal_card" };

    var r = G.play(p, i, 0);
    var last = {
      seq: pub.seq, p: orig, n: r.c.n, id: r.c.id, t: r.o.t, before: r.before, after: r.after,
      heat: r.heat, fx: r.fx, saved: r.saved, bust: r.bust, nx: (r.nx != null && r.nx >= 0) ? alive[r.nx] : r.nx
    };
    var log = (pub.log || []).concat([last]).slice(-LOG_MAX);
    var meta = { mode: pub.mode, out: pub.out, seq: pub.seq + 1, turns: pub.turns + 1, over: -1, winner: null, players: pub.players, last: last, log: log };

    var res;
    if (r.bust) {
      last.elim = orig;
      res = eliminate(snap, G, orig, meta, true, rnd);
    } else {
      var npub = pubFrom(G, alive, pub.np, meta);
      var changed = {};
      alive.forEach(function (o, q) {
        var u = snap.uids[o];
        if (JSON.stringify(snap.hands[u]) !== JSON.stringify(G.hands[q])) changed[u] = G.hands[q];
      });
      res = { pub: npub, secret: { deck: G.deck, disc: G.disc }, hands: changed, cur: npub.cur, over: -1, elim: null };
    }
    res.action = { p: orig, card_id: cardId, last: last };
    return res;
  }

  /* ยอมแพ้ (หมดเวลา/หลุด/ออก) = ตกรอบ ; ถ้าเป็นโหมดเดี่ยวหรือเหลือ 2 คน = เกมจบ */
  function applyForfeit(snap, orig, reason, rnd) {
    var pub = snap.pub;
    if (!pub || pub.over >= 0) return { error: "game_over" };
    if (pub.alive.indexOf(orig) < 0) return { error: "eliminated" };
    var last = { seq: pub.seq, p: orig, n: null, id: null, t: "", before: pub.total, after: pub.total, heat: 0, fx: null, saved: false, bust: false, nx: null, forfeit: true, reason: reason, elim: orig };
    var log = (pub.log || []).concat([last]).slice(-LOG_MAX);
    var meta = { mode: pub.mode, out: pub.out, seq: pub.seq + 1, turns: pub.turns, over: -1, winner: null, players: pub.players, last: last, log: log };
    var res = eliminate(snap, null, orig, meta, false, rnd);
    res.action = { p: orig, forfeit: true, reason: reason, last: last };
    return res;
  }

  /* สถิติท้ายเกม (สาธารณะ) */
  function summary(pub) {
    return { loser: pub.over, winner: pub.winner, turns: pub.turns, total: pub.last ? pub.last.after : pub.total, cap: pub.cap, out: pub.out };
  }

  return { startGame: startGame, applyPlay: applyPlay, applyForfeit: applyForfeit, summary: summary, copy: copy };
});
