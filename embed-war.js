// คัดลอก engine + AI ยุทธวิธีจาก online/war-engine.js เข้า index.html (ระหว่างเครื่องหมาย WT_ENGINE_START/END และ WT_AI_START/END)
// ใช้: node tools/embed-war.js · ตรวจว่าเท่ากัน: node tests/war-parity.test.js
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "../online/war-engine.js"), "utf8");
const cut = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b); if (i < 0 || j < 0) throw new Error("marker missing " + a); return s.slice(i + a.length, j) };
const eng = cut(src, "/*TACTICS_ENGINE_START*/", "/*TACTICS_ENGINE_END*/"), ai = cut(src, "/*TACTICS_AI_START*/", "/*TACTICS_AI_END*/");
const fp = path.join(__dirname, "../index.html"); let h = fs.readFileSync(fp, "utf8");
const put = (h, a, b, body) => { const i = h.indexOf(a), j = h.indexOf(b); if (i < 0 || j < 0) throw new Error("index.html marker missing " + a); return h.slice(0, i + a.length) + body + h.slice(j) };
h = put(h, "/*WT_ENGINE_START*/", "/*WT_ENGINE_END*/", eng); h = put(h, "/*WT_AI_START*/", "/*WT_AI_END*/", ai);
fs.writeFileSync(fp, h); console.log("embedded engine", eng.length, "ai", ai.length);
