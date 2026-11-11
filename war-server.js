/* HRTA สงครามไพ่ยุทธวิธี (ออนไลน์) — ตรรกะฝั่งเซิร์ฟเวอร์แบบฟังก์ชันล้วน (ไม่แตะฐานข้อมูล ทดสอบบน Node ได้)
 * snap = { pub, secret:{deck, rest, pend}, hands:{uid:[card]}, uids:[uidผู้เล่น0, uidผู้เล่น1] }
 *   pub    = สถานะสาธารณะ (เก็บใน games.public_state)  — ห้ามมี มือ/กองจั่ว/ไพ่ที่เลือกแต่ยังไม่เปิด/ไพ่คว่ำ
 *   secret = สถานะลับของ engine + pend (การเลือกที่ยังไม่เปิด)
 * ทุกฟังก์ชันคืนผลใหม่ ไม่แก้ snap เดิม; ความผิดพลาดที่คาดได้คืน { error }
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./war-engine.js"));
  else root.WarServer = factory(root.WarTactics);
})(typeof self !== "undefined" ? self : this, function (WT) {
  "use strict";
  var clone = function (x) { return JSON.parse(JSON.stringify(x)) };
  var isInt = function (v) { return Number.isInteger(v) && v >= 0 && v < 1000 };

  function rConfig(cfg) { return Object.assign({}, WT.PRESET, { clash: cfg.clash, fool: cfg.fool ? 1 : 0 }) }
  function cleanCfg(cfg) {
    cfg = cfg || {};
    var cl = cfg.clash == null ? "u" : cfg.clash;
    if (["u", "un", "eq"].indexOf(cl) < 0) return null;
    return { clash: cl, fool: (cfg.fool === 0 || cfg.fool === false || cfg.fool === "0") ? 0 : 1 };
  }

  function loadEngine(snap, rnd) {
    var E = WT.engine(rConfig(snap.pub.cfg), rnd);
    var st = clone(snap.secret.rest);
    st.deck = clone(snap.secret.deck);
    st.hands = [clone(snap.hands[snap.uids[0]]), clone(snap.hands[snap.uids[1]])];
    E.load(st);
    return E;
  }
  function dump(E, uids) {
    var s = E.save(), hands = {}; hands[uids[0]] = s.hands[0]; hands[uids[1]] = s.hands[1];
    var deck = s.deck; delete s.deck; delete s.hands;
    return { deck: deck, rest: s, hands: hands };
  }
  function autoMark(E, pend) { /* สงคราม: คนที่ไพ่หมดมือไม่ต้องเลือก (ถือว่าแพ้ศึกนั้น) */
    if (E.phase === "war" && !E.over) for (var p = 0; p < 2; p++) if (!E.hands[p].length && !pend[p]) pend[p] = { auto: 1 };
  }
  function buildPub(E, players, cm, evs, rs) {
    var p = E.pubState();
    p.players = players; p.cm = cm; p.rs = rs; p.ev = evs; p.rz = E.rz.slice();   /* จำนวนครั้งที่เพิ่มเดิมพันไปแล้ว (เปิดเผยอยู่แล้วตอนเปิดไพ่) */
    p.need = [E.phase === "war" ? E.needDown(0) : 0, E.phase === "war" ? E.needDown(1) : 0];
    p.cfg = { clash: E.R.clash, fool: E.R.fool ? 1 : 0 };
    p.res = null;
    if (E.over) { var r = E.result(); p.res = { w: r.w, a: r.a, b: r.b, why: E.over } }
    return p;
  }
  function overCode(E) { if (!E.over) return -1; var r = E.result(); return r.w === 0 ? 1 : r.w === 1 ? 0 : -2 }

  /* players: [{user_id, seat, name, avatar}] เรียงตามที่นั่ง ; cfg: {clash, fool} */
  function startGame(players, cfg, rnd) {
    var c = cleanCfg(cfg); if (!c) return { error: "bad_cfg" };
    if (!players || players.length !== 2) return { error: "bad_player_count" };
    var E = WT.engine(rConfig(c), rnd).deal(), uids = players.map(function (p) { return p.user_id });
    var pend = [null, null];
    var d = dump(E, uids);
    var pub = buildPub(E, players.map(function (p) { return { seat: p.seat, name: p.name, avatar: p.avatar } }), [false, false], [], 0);
    return { pub: pub, secret: { deck: d.deck, rest: d.rest, pend: pend }, hands: d.hands };
  }

  /* คืนข้อมูลที่ผู้เล่นรู้ได้เองจากการเลือกของตัวเอง — ตรวจรูปแบบแล้วคัดเฉพาะคีย์ที่อนุญาต */
  function normChoice(phase, ch) {
    if (!ch || typeof ch !== "object") return null;
    if (phase === "play") {
      if (!isInt(ch.c)) return null;
      var o = { c: ch.c }; if (ch.x != null) { if (!isInt(ch.x)) return null; o.x = ch.x } return o;
    }
    if (ch.r) return { r: 1 };
    if (!Array.isArray(ch.down) || ch.down.length > 3 || !ch.down.every(isInt) || !isInt(ch.up)) return null;
    return { down: ch.down.slice(), up: ch.up };
  }

  function applyChoice(snap, uid, choice, rnd) {
    var p = snap.uids.indexOf(uid);
    if (p < 0) return { error: "not_in_game" };
    if (snap.pub.over) return { error: "game_over" };
    var pend = (snap.secret.pend || [null, null]).slice();
    if (pend[p]) return { error: "already_chosen" };
    var ch = normChoice(snap.pub.phase, choice);
    if (!ch) return { error: "illegal" };
    var E = loadEngine(snap, rnd);
    var ok = snap.pub.phase === "play" ? E.legalPlay(p, ch) : E.legalWar(p, ch);
    if (!ok) return { error: "illegal" };
    pend[p] = ch;
    var cm = [!!pend[0], !!pend[1]];
    if (!(pend[0] && pend[1])) { /* ยังรออีกฝั่ง: เก็บการเลือกไว้ลับ เผยแค่ "ยืนยันแล้ว" */
      var pub1 = clone(snap.pub); pub1.cm = cm;
      return { pub: pub1, secret: { deck: snap.secret.deck, rest: snap.secret.rest, pend: pend }, hands: clone(snap.hands), over: -1, resolved: false, type: "choice" };
    }
    /* ทั้งคู่ยืนยัน → เปิดไพ่พร้อมกันและตัดสิน */
    var evs = [], guard = 0, chs = [pend[0].auto ? null : pend[0], pend[1].auto ? null : pend[1]];
    evs = evs.concat(E.step(chs));
    pend = [null, null]; autoMark(E, pend);
    while (!E.over && E.phase === "war" && pend[0] && pend[1] && guard++ < 10) { evs = evs.concat(E.step([null, null])); pend = [null, null]; autoMark(E, pend) }
    var d = dump(E, snap.uids), pub = buildPub(E, snap.pub.players, [!!pend[0], !!pend[1]], evs, (snap.pub.rs || 0) + 1);
    return { pub: pub, secret: { deck: d.deck, rest: d.rest, pend: pend }, hands: d.hands, over: overCode(E), resolved: true, type: "resolve" };
  }

  /* เริ่มเกมแล้วอาจต้อง auto-mark (ไม่เกิดตอนเริ่ม แต่เผื่อไว้) — ยอมแพ้: idx = ผู้เล่นที่แพ้ ; idx = -1 = ทั้งคู่ทิ้งเกม (เสมอ) */
  function applyForfeit(snap, idx, reason) {
    if (snap.pub.over) return { error: "game_over" };
    var pub = clone(snap.pub), a = pub.pileN[0], b = pub.pileN[1];
    pub.over = "forfeit"; pub.cm = [false, false]; pub.rs = (pub.rs || 0) + 1;
    pub.res = idx < 0 ? { w: -1, a: a, b: b, why: "abandoned", reason: reason } : { w: 1 - idx, a: a, b: b, why: "forfeit", forfeit: idx, reason: reason };
    pub.ev = [{ t: "end", why: pub.res.why, s: [a, b], forfeit: idx, reason: reason }];
    return { pub: pub, secret: snap.secret, hands: clone(snap.hands), over: idx < 0 ? -2 : idx, type: "forfeit" };
  }

  return { startGame: startGame, applyChoice: applyChoice, applyForfeit: applyForfeit, cleanCfg: cleanCfg, loadEngine: loadEngine };
});
