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
      v: 4, mode: meta.mode, np: np, alive: alive.slice(), out: meta.out.slice(),
      cap: G.cap, n: G.n, two: G.two, heatAt: G.heatAt, total: G.total, prev: G.prev,
      dir: G.dir, cur: mapLocalToOriginal(G.cur, alive), turn: G.turn, heat: G.heat(),
      seq: meta.seq, turns: meta.turns, shield: shield, sealed: sealed, skipDraw: skipDraw,
      starSafe: starSafe, devil: devil, force: G.force < 0 ? -1 : mapLocalToOriginal(G.force, alive),
      revealed: G.revealed < 0 ? -1 : mapLocalToOriginal(G.revealed, alive), revealedHand: revealedHand,
      revealTurnsLeft: G.revealed < 0 ? 0 : Math.max(0, Number(G.revealTurnsLeft || 0)),
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
      revealTurnsLeft: pub.revealed < 0 ? 0 : (Number.isInteger(pub.revealTurnsLeft) ? pub.revealTurnsLeft : 1),
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
    if (s.revealed === idx) { s.revealed = -1; s.revealedHand = {}; s.revealTurnsLeft = 0; }
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
