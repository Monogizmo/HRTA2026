/* โหมดวัดดวงเดิม: wrEngine ใน index.html ต้องไม่เปลี่ยน (แฮชซอร์ส + ผลเกมจาก seed ตายตัว) */
const fs = require("fs"), crypto = require("crypto"), S = require("../tools/war-sim.js");
const src = fs.readFileSync(__dirname + "/../index.html", "utf8");
const a = src.indexOf("function wrEngine(R,rnd){"), b = src.indexOf("/*ENGINE_END*/");
const code = src.slice(a, b);
const EXPECT_HASH = "722a846440a7e88353f829a92d63598343cdd60c7ad573972b64f5f4be997fdb"; /* v31 */
const wrEngine = new Function(code + "; return wrEngine;")();
function run(R, seed) {
  const rnd = S.mulberry(seed), E = wrEngine(R, rnd); E.deal(); let g = 0, log = [];
  while (g++ < 5000) {
    const f = E.flip(); if (f.type === "end") break; let j = f.j, w = -2;
    while (j.kind === "clash") { const o = E.war(); if (o.forfeit >= 0) { w = o.forfeit === 2 ? -1 : 1 - o.forfeit; break } j = o.j }
    if (w === -2) w = j.w; E.collect(w, j.fool); log.push(w);
    if (E.overReason()) break;
  }
  const r = E.result(); return r.a + "-" + r.b + ":" + E.round + ":" + E.wars + ":" + log.join("");
}
let bad = 0;
const h = crypto.createHash("sha256").update(code).digest("hex");
if (h !== EXPECT_HASH) { bad++; console.log("FAIL: wrEngine source changed", h) }
const sig = []; for (const R of [{len: "short", clash: "u", fool: 1, cap: 60}, {len: "short", clash: "un", fool: 0, cap: 60}, {len: "long", clash: "eq", fool: 1, cap: 60}]) for (let s = 1; s <= 200; s++) sig.push(run(R, s));
const sh = crypto.createHash("sha256").update(sig.join("|")).digest("hex");
const EXPECT_SIG = process.env.WAR_LEGACY_RECORD ? null : fs.readFileSync(__dirname + "/war-legacy.sig", "utf8").trim();
if (process.env.WAR_LEGACY_RECORD) { fs.writeFileSync(__dirname + "/war-legacy.sig", sh + "\n"); console.log("recorded", sh) }
else if (sh !== EXPECT_SIG) { bad++; console.log("FAIL: seeded results changed", sh) }
console.log(bad ? "FAILED" : "war-legacy OK (600 seeded games)"); process.exit(bad ? 1 : 0);
