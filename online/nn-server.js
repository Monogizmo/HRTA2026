/* HRTA Number Ceiling — ตรรกะฝั่งเซิร์ฟเวอร์ (ฟังก์ชันล้วน ไม่แตะ DB/เครือข่าย จึงทดสอบบน Node ได้)
 * ใช้โดย Supabase Edge Function `nn-api` เท่านั้น  ตัวสุ่ม rnd ต้องมาจากเซิร์ฟเวอร์ (crypto)
 * ข้อมูลแบ่ง 3 ชั้น:  pub = สาธารณะ (ทุกคนในห้องเห็น) · hands = มือของแต่ละคน (เห็นเฉพาะเจ้าของ) · secret = สำรับ/กองทิ้ง (ไม่มีใครเห็น)
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./nn-engine.js"));
  else root.NNServer = factory(root.NNEngine);
})(typeof self !== "undefined" ? self : this, function (NN) {
  "use strict";
  var LOG_MAX = 8;

  function copy(x) { return JSON.parse(JSON.stringify(x)); }

  // สร้างสถานะสาธารณะจาก engine ที่กำลังเล่น
  function pubFrom(G, players, last, log) {
    return {
      v: 1, cap: G.cap, n: G.n, two: G.two, heatAt: G.heatAt,
      total: G.total, prev: G.prev, dir: G.dir, cur: G.cur, turn: G.turn, heat: G.heat(),
      shield: G.shield.slice(), dbl: G.dbl ? { p: G.dbl.p, left: G.dbl.left } : null,
      force: G.force, over: G.over,
      handCounts: G.hands.map(function (h) { return h.length; }),
      players: players, last: last || null, log: log || []
    };
  }

  /* เริ่มเกม: players = [{user_id, seat, name, avatar}] (2–4 คน) ; p (ลำดับใน engine) = ลำดับที่นั่งจากน้อยไปมาก */
  function startGame(players, cap, rnd) {
    var ps = players.slice().sort(function (a, b) { return a.seat - b.seat; });
    var n = ps.length;
    if (n < 2 || n > 4) return { error: "bad_player_count" };
    if ([120, 150, 200].indexOf(cap) < 0) return { error: "bad_cap" };
    var G = NN.engine({ cap: cap, n: n }, rnd);
    G.deal();
    G.cur = Math.floor(rnd() * n);                       // สุ่มคนเริ่ม (ฝั่งเซิร์ฟเวอร์)
    var pl = ps.map(function (x, p) { return { p: p, seat: x.seat, name: x.name, avatar: x.avatar }; });
    var hands = {};
    ps.forEach(function (x, p) { hands[x.user_id] = G.hands[p]; });
    return {
      pub: pubFrom(G, pl, null, []),
      secret: { deck: G.deck, disc: G.disc },
      hands: hands,
      uids: ps.map(function (x) { return x.user_id; }),
      cur: G.cur
    };
  }

  /* ลงไพ่ 1 ใบ
   * snap = { pub, secret:{deck,disc}, hands:{uid:[card]}, uids:[uid ตามลำดับ p] }
   * คืน { error } หรือ { pub, secret, hands(เฉพาะที่เปลี่ยน), cur, over, action } */
  function applyPlay(snap, uid, cardId, rnd) {
    var pub = snap.pub;
    if (!pub || pub.over >= 0) return { error: "game_over" };
    var p = snap.uids.indexOf(uid);
    if (p < 0) return { error: "not_in_game" };
    if (pub.cur !== p) return { error: "not_your_turn" };
    var mine = snap.hands[uid] || [];
    var i = -1;
    for (var k = 0; k < mine.length; k++) if (mine[k].id === cardId) { i = k; break; }
    if (i < 0) return { error: "card_not_in_hand" };

    var st = {
      cap: pub.cap, n: pub.n, two: pub.two, heatAt: pub.heatAt, total: pub.total, prev: pub.prev,
      dir: pub.dir, cur: pub.cur, over: pub.over, turn: pub.turn, shield: pub.shield, dbl: pub.dbl, force: pub.force,
      deck: snap.secret.deck, disc: snap.secret.disc,
      hands: snap.uids.map(function (u) { return snap.hands[u]; })
    };
    var G = NN.importState(st, rnd);
    if (G.legal(p).indexOf(i) < 0) return { error: "illegal_card" };

    var r = G.play(p, i, 0);
    var last = {
      seq: pub.turn, p: p, n: r.c.n, id: r.c.id, t: r.o.t, before: r.before, after: r.after,
      heat: r.heat, fx: r.fx, saved: r.saved, bust: r.bust, nx: r.nx
    };
    var log = (pub.log || []).concat([last]).slice(-LOG_MAX);
    var npub = pubFrom(G, pub.players, last, log);

    var changed = {};
    snap.uids.forEach(function (u, q) {
      if (JSON.stringify(snap.hands[u]) !== JSON.stringify(G.hands[q])) changed[u] = G.hands[q];
    });
    return {
      pub: npub, secret: { deck: G.deck, disc: G.disc }, hands: changed,
      cur: G.cur, over: G.over, action: { p: p, card_id: cardId, last: last }
    };
  }

  /* สถิติท้ายเกม (สาธารณะ) */
  function summary(pub) {
    return { loser: pub.over, turns: pub.turn, total: pub.last ? pub.last.after : pub.total, cap: pub.cap };
  }

  return { startGame: startGame, applyPlay: applyPlay, summary: summary, copy: copy };
});
