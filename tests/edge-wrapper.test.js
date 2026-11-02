// ทดสอบตัวห่อ Deno (CORS / ตรวจ JWT / รูปแบบคำตอบ) โดยรันไฟล์ bundle จริงกับ Deno และ createClient จำลอง
const fs = require("fs"), assert = require("assert");
let src = fs.readFileSync(__dirname + "/../supabase/functions/nn-api/index.ts", "utf8");
src = src.replace(/^import .*$/m, "").replace("const self = globalThis;", "");
let handler;
const users = { goodtoken: { id: "11111111-1111-1111-1111-111111111111" } };
const Deno = { env: { get: k => ({ SUPABASE_URL: "http://x", SUPABASE_SERVICE_ROLE_KEY: "k" }[k]) }, serve: h => { handler = h; } };
const createClient = () => ({ auth: { getUser: async t => users[t] ? { data: { user: users[t] }, error: null } : { data: null, error: { message: "bad" } } } });
new Function("Deno", "createClient", "globalThis", "self", src)(Deno, createClient, globalThis, globalThis);
const call = (method, headers, body) => handler(new Request("http://f/nn-api", { method, headers, body }));
(async () => {
  let r = await call("OPTIONS", { origin: "https://monogizmo.github.io" });
  assert.strictEqual(r.headers.get("access-control-allow-origin"), "https://monogizmo.github.io");
  r = await call("OPTIONS", { origin: "https://evil.example" });
  assert.notStrictEqual(r.headers.get("access-control-allow-origin"), "https://evil.example");
  r = await call("POST", {}, "{}"); assert.strictEqual(r.status, 401);
  r = await call("POST", { authorization: "Bearer nope" }, "{}"); assert.strictEqual(r.status, 401);
  r = await call("POST", { authorization: "Bearer goodtoken" }, "not json"); assert.strictEqual(r.status, 400);
  r = await call("POST", { authorization: "Bearer goodtoken" }, JSON.stringify({ action: "zzz" }));
  assert.strictEqual(r.status, 200); assert.deepStrictEqual(await r.json(), { error: "bad_action" });
  r = await call("GET", { authorization: "Bearer goodtoken" }); assert.strictEqual(r.status, 405);
  console.log("ok  edge wrapper: CORS allow-list, JWT required/verified, bad JSON, bad action, method check");
})().catch(e => { console.error(e); process.exit(1); });
