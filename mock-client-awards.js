// ฝั่งเบราว์เซอร์: Supabase client จำลองที่คุยกับ tests/e2e/awards-server.js (ตั้ง window.__USER และ window.__SRV ก่อนโหลด)
(function () {
  var USER = window.__USER, SRV = window.__SRV, ses = null;
  window.__CALLS = [];
  function post(path, body) { return fetch(SRV + path, { method: "POST", headers: { "x-user": USER, "x-now": String(Date.now()), "Content-Type": "application/json" }, body: JSON.stringify(body || {}) }).then(function (r) { return r.json(); }); }
  window.supabase = { createClient: function () { return {
    auth: { getSession: function () { return Promise.resolve({ data: { session: ses } }); }, signInAnonymously: function () { ses = { access_token: "t", user: { id: USER } }; return Promise.resolve({ data: { session: ses }, error: null }); } },
    realtime: { setAuth: function () {} },
    rpc: function (fn, a) { window.__CALLS.push(fn); if (window.__OFFLINE) return Promise.reject(new TypeError("Failed to fetch")); return post("/rpc/" + fn, a).then(function (j) { return j.error ? { data: null, error: j.error } : { data: j.data, error: null }; }); }
  }; } };
})();
