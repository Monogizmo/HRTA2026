/* ตัวจำลองสมดุลสงครามไพ่ยุทธวิธี — ใช้ engine ที่ส่งมอบจริง (online/war-engine.js)
 * ใช้: node tools/war-sim.js [pw|simple|both] [เกม] [seed]  */
const W = require("../online/war-engine.js");
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
function game(R, lv, seed, rec) { /* lv=[ระดับ p0, ระดับ p1] */
  const rnd = mulberry(seed), E = W.engine(R, rnd).deal(); let rounds = 0, guard = 0;
  const played = [new Set(), new Set()];
  while (!E.over && guard++ < 400) {
    let ch = [null, null];
    if (E.phase === "play") for (let p = 0; p < 2; p++) ch[p] = W.playDecide(E.view(p), lv[p], rnd);
    else for (let p = 0; p < 2; p++) ch[p] = E.hands[p].length ? W.warDecide(E.view(p), lv[p], rnd) : null;
    const ev = E.step(ch);
    if (E.phase !== "war" || E.over) { /* จบรอบ */ }
    ev.forEach(e => {
      if (e.t === "flip") { played[0].add(e.up[0]); played[1].add(e.up[1]); rec.cardRound && (rec.cur = e.up.slice()) }
      if (e.t === "res" && rec.cur) { const w = e.w; for (let p = 0; p < 2; p++) { const n = rec.cur[p]; (rec.cr[n] = rec.cr[n] || [0, 0]); rec.cr[n][0]++; if (p === w) rec.cr[n][1]++ } rec.cur = null }
    });
  }
  const r = E.result();
  return {E, r, played, rounds: E.round, over: E.over, guard};
}
function match(R, a, b, N, seed) {
  const o = {n: 0, wa: 0, wb: 0, dr: 0, rounds: [], wars: [], diff: [], maxd: 0, cap: 0, hang: 0, ret: 0, cardGame: Array.from({length: 22}, () => [0, 0]), used: {}, rwars: 0, depth: []};
  const rec = {cr: [], cardRound: false};
  for (let i = 0; i < N; i++) {
    const sw = i % 2, lv = sw ? [b, a] : [a, b];
    const g = game(R, lv, seed + i * 7919, rec); o.n++;
    const wa = sw ? g.r.w === 1 : g.r.w === 0, wb = sw ? g.r.w === 0 : g.r.w === 1;
    if (g.r.w < 0) o.dr++; else if (wa) o.wa++; else o.wb++;
    if (g.over === "cap") o.cap++; if (g.guard >= 400) o.hang++;
    o.rounds.push(g.rounds); o.wars.push(g.E.wars); o.diff.push(Math.abs(g.r.a - g.r.b)); o.maxd = Math.max(o.maxd, g.E.st.maxd);
    o.ret += g.E.st.ret[0] + g.E.st.ret[1];
    for (const k in g.E.st.used) o.used[k] = (o.used[k] || 0) + g.E.st.used[k];
    for (let p = 0; p < 2; p++) { const win = g.r.w === p ? 1 : g.r.w < 0 ? 0.5 : 0; g.played[p].forEach(n => { o.cardGame[n][0]++; o.cardGame[n][1] += win }) }
  }
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  o.winA = o.wa / (o.wa + o.wb); o.avgRounds = avg(o.rounds); o.avgWars = avg(o.wars); o.avgDiff = avg(o.diff); o.avgRet = o.ret / N; o.drawRate = o.dr / N;
  return o;
}
module.exports = {match, game, mulberry};
if (require.main === module) {
  const N = +process.argv[2] || 300, seed = +process.argv[3] || 1, f = x => (x * 100).toFixed(1) + "%";
  const R = Object.assign({}, W.PRESET); console.log("=== ยุทธวิธี (ไม่มีพลังพิเศษ)", JSON.stringify(R));
  const rows = [["normal", "random"], ["hard", "normal"], ["normal", "normal"], ["novice", "normal"], ["retreatAlways", "normal"], ["retreatNever", "normal"]];
  for (const [a, b] of rows) {
    const o = match(R, a, b, N, seed);
    console.log(a.padEnd(14), "vs", b.padEnd(8), "winA", f(o.winA), "draw", f(o.drawRate), "rounds", o.avgRounds.toFixed(1), "wars", o.avgWars.toFixed(2), "ret/g", o.avgRet.toFixed(2), "|Δ|", o.avgDiff.toFixed(1), "cap", o.cap, "hang", o.hang);
  }
}
