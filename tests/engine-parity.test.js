// รัน: node tests/engine-parity.test.js
// ตรวจ parity ระหว่าง Shared Engine กับสำเนา offline ใน index.html และทดสอบ Tarot rules / private-state handling
const fs = require("fs"), path = require("path"), assert = require("assert");
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const shared = fs.readFileSync(path.join(root, "online/nn-engine.js"), "utf8");
const NN = require("../online/nn-engine.js");
const SV = require("../online/nn-server.js");
const RES = [0, 9, 11, 12, 13, 16, 17, 18, 20];
const clone = x => JSON.parse(JSON.stringify(x));

const shStart = shared.indexOf("  function nnEngine(o, rnd) {");
const shEnd = shared.indexOf("\n  var KEYS =", shStart);
const inStart = html.indexOf("function nnEngine(o,rnd){");
const inEnd = html.indexOf("\nnnApi.engine=nnEngine;", inStart);
assert.ok(shStart >= 0 && shEnd > shStart && inStart >= 0 && inEnd > inStart, "engine function not found");
const shFn = shared.slice(shStart, shEnd).split("\n").map(x => x.replace(/^  /, "")).join("\n").replace("function nnEngine(o, rnd) {", "function nnEngine(o,rnd){");
const inFn = html.slice(inStart, inEnd).trim();
assert.strictEqual(inFn.replace("\n    function clone(x){return JSON.parse(JSON.stringify(x));}", ""), shFn,
  "inline engine must be an exact copy of shared engine (except local clone helper)");
const offlineFactory = new Function("RES", inFn + "\nreturn nnEngine;")(RES);
const sharedFactory = new Function("clone", "RES", shared.slice(shStart, shEnd) + "\nreturn nnEngine;")(clone, RES);
console.log("ok  engine parity: inline and shared engine source/functions match");

function prng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function mk(n = 3, cap = 120) {
  const G = NN.engine({ n, cap }, prng(8)); G.deal();
  G.hands = Array.from({ length: n }, (_, p) => [0, 1, 2].map((v) => ({ n: v + p * 3, id: p * 10 + v })));
  G.deck = Array.from({ length: 30 }, (_, i) => ({ n: i % 22, id: 100 + i })); G.disc = [];
  G.total = 0; G.prev = 0; G.turn = 0; G.cur = 0; G.over = -1; G.dir = 1;
  G.pending = null; G.phase = "await_play"; G.shield = Array(n).fill(false); G.sealed = Array(n).fill(false);
  G.skipDraw = Array(n).fill(false); G.starSafe = Array(n).fill(0); G.devil = Array(n).fill(false); G.force = -1;
  G.revealed = -1; G.revealedHand = {}; G.sunOptions = {};
  G.turnState = { p: 0, kind: "normal", played: 0, need: 1, sunChosen: false, postDraw: [] };
  return G;
}
function card(G, p, n, i = 0) { G.hands[p][i] = { n, id: 1000 + p * 100 + i }; return i; }
function play(G, p, n, choice = {}, i = 0) { G.cur = p; G.turnState.p = p; return G.play(p, card(G, p, n, i), 0, choice); }

// Priestess: swap tens / units first, then +2; preserve hundreds.
{
  let G = mk(2); G.total = 47; let r = play(G, 0, 2); assert.strictEqual(r.after, 76);
  G = mk(2, 200); G.total = 120; r = play(G, 0, 2); assert.strictEqual(r.after, 104);
  console.log("ok  Priestess: 47→76 and 120→104");
}
// Heat boundary, Star exception and two-own-turn protection; World ignores Heat.
{
  let G = mk(3); G.turn = 20; G.total = 10; let r = play(G, 0, 1); assert.strictEqual(r.heat, 1); assert.strictEqual(r.after, 12);
  G = mk(3); G.turn = 20; G.total = 100; r = play(G, 0, 17, { value: -17 });
  assert.strictEqual(r.heat, 0); assert.strictEqual(r.after, 83); assert.strictEqual(G.starSafe[0], 1);
  play(G, 1, 1); play(G, 2, 1); r = play(G, 0, 1); assert.strictEqual(r.heat, 0); assert.strictEqual(G.starSafe[0], 0);
  G = mk(2); G.turn = 80; G.total = 20; r = play(G, 0, 21); assert.strictEqual(r.after, 120); assert.strictEqual(r.heat, 0); assert.strictEqual(r.bust, false);
  console.log("ok  Heat: threshold, Star current+next own turn, World immunity");
}
// Emperor seals exactly the next played card: face value only, without its ability.
{
  const G = mk(3); G.sealed[1] = true; G.total = 10; G.cur = 1; G.turnState = { p: 1, kind: "normal", played: 0, need: 1, sunChosen: false, postDraw: [] };
  const r = play(G, 1, 8); assert.strictEqual(r.sealed, true); assert.strictEqual(r.after, 18); assert.strictEqual(G.sealed[1], false);
  console.log("ok  Emperor seal: Strength is +8, not ×2, and seal is consumed");
}
// Chariot prompts for a second card; skip ends normally; no third card can be granted.
{
  let G = mk(2); card(G, 0, 7); let r = G.play(0, 0, 0, {});
  assert.strictEqual(r.pending.type, "chariot"); assert.strictEqual(G.cur, 0); assert.strictEqual(G.hands[0].length, 2);
  r = G.play(0, 0, 0, {}); assert.strictEqual(G.cur, 1); assert.strictEqual(G.hands[0].length, 3);
  G = mk(2); card(G, 0, 7); r = G.play(0, 0, 0, {}); assert.ok(G.skip(0).ok); assert.strictEqual(G.cur, 1);
  console.log("ok  Chariot: extra play or skip, draw count follows cards played");
}
// Devil: forced two cards, no interim refill; even a Chariot cannot add a third.
{
  const G = mk(2); let r = play(G, 0, 15); assert.strictEqual(G.turnState.kind, "devil"); assert.strictEqual(G.cur, 1);
  const len = G.hands[1].length; card(G, 1, 7); r = G.play(1, 0, 0, {});
  assert.strictEqual(G.cur, 1); assert.strictEqual(G.hands[1].length, len - 1); assert.strictEqual(r.pending, null);
  r = G.play(1, 0, 0, {}); assert.strictEqual(G.cur, 0); assert.strictEqual(G.hands[1].length, len);
  console.log("ok  Devil: two consecutive plays, no Chariot stacking, refill two afterward");
}
// Sun: 3 private options, one selected instead of a normal draw, two go to bottom.
{
  const G = mk(2); card(G, 0, 19); const deckBefore = G.deck.length;
  const r = G.play(0, 0, 0, {}); assert.strictEqual(r.pending.type, "sun");
  assert.strictEqual(G.sunOptions[0].length, 3); assert.strictEqual(G.phase, "await_sun");
  const selected = G.sunOptions[0][1]; const chosen = G.choose(0, { index: 1 });
  assert.ok(chosen.ok); assert.strictEqual(chosen.chosen.id, selected.id); assert.ok(G.hands[0].some(c => c.id === selected.id));
  assert.strictEqual(G.deck.length, deckBefore - 1); assert.strictEqual(G.hands[0].length, 3);
  console.log("ok  Sun: private 3-card choice replaces refill; unselected cards return to deck bottom");
}
// Empress interruption scores and heats immediately, then her next own turn is draw-only.
{
  const G = mk(3); card(G, 1, 3); card(G, 2, 3); const before = G.hands[1].length;
  let r = G.interrupt(1, 0); assert.strictEqual(r.interrupt, true); assert.strictEqual(G.total, 3); assert.strictEqual(G.cur, 0);
  assert.strictEqual(G.hands[1].length, before - 1); assert.strictEqual(G.skipDraw[1], true);
  assert.strictEqual(G.canInterrupt(2), true); // another eligible player may still interrupt
  play(G, 0, 1); assert.strictEqual(G.cur, 2); // p1 skipped and drew one
  assert.strictEqual(G.hands[1].length, before); assert.strictEqual(G.skipDraw[1], false);
  assert.ok(G.interrupt(1, 0).error);
  console.log("ok  Empress: off-turn +3, no immediate refill, next own turn draw-only");
}
// Remaining score/state abilities.
{
  let G = mk(3); G.total = 80; G.prev = 42; let r = play(G, 0, 13); assert.strictEqual(r.after, 42); // score-only rollback
  G = mk(3); G.total = 51; r = play(G, 0, 14); assert.strictEqual(r.after, 86); assert.strictEqual(G.dir, -1);
  G = mk(3); G.total = 70; G.shield[0] = true; r = play(G, 0, 8); assert.strictEqual(r.saved, true); assert.strictEqual(r.after, 105); assert.strictEqual(G.shield[0], false);
  G = mk(3); G.total = 10; card(G, 0, 4); r = G.play(0, 0, 0, { target: 2 }); assert.strictEqual(G.sealed[2], true);
  G = mk(3); card(G, 0, 0); r = G.play(0, 0, 0, { target: 0 }); assert.strictEqual(G.hands[0].length, 3);
  G = mk(3); card(G, 0, 18); r = G.play(0, 0, 0, { target: 2 }); assert.strictEqual(G.revealed, 2); assert.ok(G.revealedHand[2]);
  console.log("ok  Rebirth, Temperance, Hermit shield, Emperor target, Fool swap, Moon reveal smoke tests");
}

// Server public state never contains Sun options; Moon's exposed hand is deliberately public.
{
  const players = [0, 1, 2].map(i => ({ user_id: "u" + i, seat: i + 1, name: "P" + i, avatar: "" }));
  const S0 = SV.startGame(players, 150, prng(123), "one_loser");
  const snap = { pub: S0.pub, secret: S0.secret, hands: S0.hands, private: S0.private, uids: S0.uids };
  const p = snap.pub.cur, uid = snap.uids[p];
  snap.hands[uid] = [{ n: 19, id: 700 }, { n: 1, id: 701 }, { n: 2, id: 702 }];
  let res = SV.applyPlay(snap, uid, 700, prng(3), {}); assert.ok(!res.error, res.error);
  assert.strictEqual(res.pub.pending.type, "sun");
  assert.ok(res.private[uid] && res.private[uid].pending.sunOptions.length === 3);
  assert.ok(!JSON.stringify(res.pub).includes("sunOptions"));
  const optIds = res.private[uid].pending.sunOptions.map(x => x.id);
  assert.ok(optIds.every(id => !JSON.stringify(res.pub).includes(String(id))));
  const sunSnap = { pub: res.pub, secret: res.secret, hands: Object.assign({}, snap.hands, res.hands),
    private: Object.assign({}, snap.private, res.private), uids: snap.uids };
  const choice = SV.applyChoose(sunSnap, uid, 0, prng(4)); assert.ok(!choice.error, choice.error);
  const moonSnap = { pub: S0.pub, secret: S0.secret, hands: Object.assign({}, S0.hands), private: S0.private, uids: S0.uids };
  const mu = moonSnap.uids[moonSnap.pub.cur], mp = moonSnap.pub.cur, target = moonSnap.pub.alive.find(x => x !== mp);
  moonSnap.hands[mu] = [{ n: 18, id: 800 }, { n: 3, id: 801 }, { n: 4, id: 802 }];
  res = SV.applyPlay(moonSnap, mu, 800, prng(5), { target }); assert.ok(!res.error, res.error);
  assert.deepStrictEqual(res.pub.revealedHand[target], moonSnap.hands[moonSnap.uids[target]]);
  console.log("ok  server privacy: Sun options only in actor private state; Moon reveal is public and scoped");
  // A live Moon reveal must refresh if a later effect changes the exposed player's hand.
  const G = mk(4); card(G, 0, 18); G.play(0, 0, 0, { target: 3 });
  assert.strictEqual(G.revealed, 3); const oldHand = clone(G.revealedHand[3]);
  card(G, 1, 20); G.play(1, 0, 0, {});
  assert.deepStrictEqual(G.revealedHand[3], G.hands[3]);
  assert.notDeepStrictEqual(G.revealedHand[3], oldHand);
  // If the Sun chooser forfeits while the choice is pending, all 3 cards return to deck bottom.
  const S1 = SV.startGame(players, 150, prng(303), "elimination");
  const fsnap = { pub: S1.pub, secret: S1.secret, hands: S1.hands, private: S1.private, uids: S1.uids };
  const fp = fsnap.pub.cur, fu = fsnap.uids[fp];
  fsnap.hands[fu] = [{ n: 19, id: 990 }, { n: 1, id: 991 }, { n: 2, id: 992 }];
  const fr = SV.applyPlay(fsnap, fu, 990, prng(304), {});
  const pendingSnap = { pub: fr.pub, secret: fr.secret, hands: Object.assign({}, fsnap.hands, fr.hands),
    private: Object.assign({}, fsnap.private, fr.private), uids: fsnap.uids };
  const beforeCount = pendingSnap.secret.deck.length + Object.values(pendingSnap.private).reduce((a, x) => a + ((x.pending && x.pending.sunOptions) || []).length, 0);
  const forfeited = SV.applyForfeit(pendingSnap, fp, "left", prng(305));
  assert.ok(!forfeited.error, forfeited.error); assert.strictEqual(forfeited.pub.pending, null);
  assert.strictEqual(forfeited.secret.deck.length, pendingSnap.secret.deck.length + 3);
  assert.strictEqual(beforeCount, forfeited.secret.deck.length + Object.values(forfeited.private).reduce((a, x) => a + ((x.pending && x.pending.sunOptions) || []).length, 0));
  console.log("ok  pending edge cases: Moon live-refresh; forfeiting during Sun conserves all three options");
}

// Run representative decisions through both factories and check deterministic same-output behavior.
{
  const A = offlineFactory({ cap: 150, n: 3 }, prng(99)); A.deal();
  const B = sharedFactory({ cap: 150, n: 3 }, prng(99)); B.deal();
  assert.deepStrictEqual(A.hands, B.hands); assert.deepStrictEqual(A.deck, B.deck);
  const p = A.cur, i = A.legal(p)[0], c = A.hands[p][i];
  const choice = c.n === 17 ? { value: 17 } : c.n === 0 ? { target: p } : (c.n === 4 || c.n === 18) ? { target: (p + 1) % 3 } : {};
  assert.deepStrictEqual(A.play(p, i, 0, choice), B.play(p, i, 0, clone(choice)));
  assert.deepStrictEqual(A.hands, B.hands); assert.strictEqual(A.total, B.total); assert.strictEqual(A.cur, B.cur);
  console.log("ok  deterministic offline/shared engine parity");
}
console.log("ALL PASSED");
