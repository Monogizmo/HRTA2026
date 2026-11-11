/* property test: ไพ่ครบ 44 ใบทุกขั้น, ไม่มีเกมวนไม่รู้จบ, ไม่ throw — นโยบายสุ่มที่ถูกกติกา (เร็ว) — N=WAR_PROP_N (ค่าเริ่มต้น 100000 ต่อโหมด) */
const W = require("../online/war-engine.js"), S = require("../tools/war-sim.js");
const N = +process.env.WAR_PROP_N || 100000; let bad = 0, maxR = 0, ties = 0, maxStep = 0;
for (const clash of ["u", "un", "eq"]) {
  const n = Math.floor(N / 3); let nb = 0;
  for (let i = 0; i < n; i++) {
    const r = S.mulberry((i + (+process.env.WAR_PROP_OFF || 0)) * 31 + 5), E = W.engine(Object.assign({}, W.PRESET, {clash}), r).deal(); let g = 0;
    try {
      while (!E.over && g++ < 500) {
        const ch = [null, null];
        for (let p = 0; p < 2; p++) ch[p] = E.phase === "play" ? W.playDecide(E.view(p), "random", r) : (E.hands[p].length ? W.warDecide(E.view(p), "random", r) : null);
        E.step(ch);
        const tot = E.deck.length + E.hands[0].length + E.hands[1].length + E.piles[0].length + E.piles[1].length + E.disc.length + E.pot.length;
        const ids = new Set([].concat(E.deck, E.hands[0], E.hands[1], E.piles[0], E.piles[1], E.disc, E.pot).map(c => c.id));
        if (tot !== 44 || ids.size !== 44) { nb++; break }
      }
    } catch (e) { nb++; console.log("throw", clash, i, e.message) }
    if (g >= 500) nb++; maxR = Math.max(maxR, E.round); maxStep = Math.max(maxStep, g);
  }
  console.log(clash, n, "games, failures:", nb); bad += nb;
}
console.log(bad ? "FAILED" : "war-prop OK", "max rounds", maxR);
process.exit(bad ? 1 : 0);
