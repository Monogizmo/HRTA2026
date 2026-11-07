// รวม engine + server + api-core (เลขเพดาน + สงครามไพ่ยุทธวิธี) + ตัวห่อ Deno เป็นไฟล์เดียว: supabase/functions/nn-api/index.ts
// (วางลง Dashboard > Edge Functions ได้เลย โดยไม่ต้องใช้ CLI)   รัน: node tools/build-edge.js
const fs = require("fs"), path = require("path"), cp = require("child_process");
const root = path.join(__dirname, "..");
const rd = f => fs.readFileSync(path.join(root, f), "utf8");
const bundle = ["online/nn-engine.js", "online/nn-server.js", "online/war-engine.js", "online/war-server.js", "online/war-api-core.js", "online/nn-api-core.js"]
  .map(f => "/* ===== " + f + " ===== */\n" + rd(f)).join("\n");
const out = rd("tools/edge-main.ts").replace("/*__BUNDLE__*/", () => bundle);
const dest = path.join(root, "supabase/functions/nn-api/index.ts");
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, out);
// ตรวจไวยากรณ์เบื้องต้น: ตัด import/Deno ออกแล้วให้ node ตรวจ
const probe = out.replace(/^import .*$/m, "").replace(/Deno\.serve\(/, "(function(){})(").replace(/Deno\.env/g, "({get(){return ''}})").replace("const self = globalThis;", "");
const tmp = path.join(require("os").tmpdir(), "nn-edge-probe.js");
fs.writeFileSync(tmp, probe);
cp.execFileSync(process.execPath, ["--check", tmp]);
console.log("built", dest, (out.length / 1024).toFixed(1) + " KB");
