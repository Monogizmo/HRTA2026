/* engine + AI ใน index.html ต้องเหมือน online/war-engine.js ทุกตัวอักษร */
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "../online/war-engine.js"), "utf8"), h = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const cut = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b); return i < 0 || j < 0 ? null : s.slice(i + a.length, j) };
let bad = 0;
for (const [n, a, b, c, d] of [["engine", "/*TACTICS_ENGINE_START*/", "/*TACTICS_ENGINE_END*/", "/*WT_ENGINE_START*/", "/*WT_ENGINE_END*/"], ["ai", "/*TACTICS_AI_START*/", "/*TACTICS_AI_END*/", "/*WT_AI_START*/", "/*WT_AI_END*/"]]) {
  const x = cut(src, a, b), y = cut(h, c, d);
  if (x == null || y == null || x !== y) { bad++; console.log("FAIL parity:", n, x == null ? "src marker" : y == null ? "index marker" : "differs") } else console.log("ok  parity:", n, x.length, "chars");
}
process.exit(bad ? 1 : 0);
