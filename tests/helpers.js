// ตัวช่วยร่วมของเทสต์: ตัวสุ่มแบบกำหนด seed และ "ตัวแทนผู้เล่น" ที่เลือก action ที่ถูกกติกาจากสถานะของเซิร์ฟเวอร์
const NN = require("../online/nn-engine.js");
function prng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// snap = { pub, hands:{uid:[card]}, uids:[uid ตามดัชนีเดิม], extras:{uid:{pick:[...]}} }
// คืน action ถัดไปของผู้ที่ต้องลง (actor) : {uid, kind:'play'|'pass'|'pick', card_id?, k?, tg?, idx?}
function agent(snap, mv) {
  const pub = snap.pub, actor = pub.pend ? pub.pend.p : pub.cur, uid = snap.uids[actor];
  if (pub.pend && pub.pend.t === "pick") return { uid, kind: "pick", idx: Math.floor(mv() * 3) % ((snap.extras[uid] && snap.extras[uid].pick.length) || 1) };
  if (pub.pend && pub.pend.t === "extra" && mv() < 0.5) return { uid, kind: "pass" };
  const hand = snap.hands[uid];
  let cand = hand.slice();
  if (pub.force === actor) { const mx = Math.max(...cand.map(c => c.n)); cand = cand.filter(c => c.n === mx); }
  const c = cand[Math.floor(mv() * cand.length)];
  const G = NN.engine({ cap: pub.cap, n: pub.alive.length }); G.total = pub.total; G.prev = pub.prev;
  const sealed = pub.seal[actor], os = sealed ? [{ fx: "" }] : G.opts(c.n), k = Math.floor(mv() * os.length);
  let tg = null;
  if (!sealed && G.needsTarget(os[k].fx) && pub.alive.length > 2) { const others = pub.alive.filter(o => o !== actor); tg = others[Math.floor(mv() * others.length)]; }
  return { uid, kind: "play", card_id: c.id, k, tg };
}
// ผู้เล่นที่ไม่ใช่ actor ที่อยากแทรกด้วย Empress (สุ่ม) — คืน uid หรือ null
function wantsInterject(snap, mv, chance) {
  const pub = snap.pub; if (pub.over >= 0 || pub.pend || pub.seq) return null;
  for (const o of pub.alive) {
    if (o === pub.cur || pub.owe[o] || pub.seal[o] || (pub.dbl && pub.dbl.p === o)) continue;
    const u = snap.uids[o], h = snap.hands[u];
    if (h.some(c => c.n === 3) && mv() < chance) return u;
  }
  return null;
}
module.exports = { prng, agent, wantsInterject };
