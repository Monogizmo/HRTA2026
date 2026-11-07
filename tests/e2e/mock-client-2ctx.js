// ฝั่งเบราว์เซอร์: Supabase client จำลองที่คุยกับ tests/e2e/two-ctx-server.js (ตั้ง window.__USER และ window.__SRV ก่อนโหลด)
(function () {
  var USER = window.__USER, SRV = window.__SRV, last = -1, cbs = [];
  function post(path, body) { return fetch(SRV + path, { method: "POST", headers: { "x-user": USER, "Content-Type": "application/json" }, body: JSON.stringify(body || {}) }).then(function (r) { return r.json(); }); }
  function builder(table) {
    var q = { table: table, f: [], ord: null, lim: null }, single = false;
    var b = { select: function () { return b; }, eq: function (k, v) { q.f.push([k, v, 0]); return b; }, is: function (k, v) { q.f.push([k, null, 1]); return b; },
      order: function (k, o) { q.ord = [k, !(o && o.ascending === false)]; return b; }, limit: function (n) { q.lim = n; return b; },
      maybeSingle: function () { single = true; return b.then(); },
      then: function (res, rej) { return post("/q", q).then(function (j) { if (j.error) return { data: null, error: j.error }; return { data: single ? (j.data[0] || null) : j.data, error: null }; }).then(res, rej); } };
    return b;
  }
  var realFetch = window.fetch;
  window.fetch = function (url, opt) {
    if (String(url).indexOf("/functions/v1/nn-api") > -1) return post("/fn", JSON.parse(opt.body)).then(function (o) { return new Response(JSON.stringify(o), { status: 200 }); });
    return realFetch.apply(this, arguments);
  };
  var ses = null;
  window.supabase = { createClient: function () {
    return {
      auth: { getSession: function () { return Promise.resolve({ data: { session: ses } }); }, signInAnonymously: function () { ses = { access_token: "t", user: { id: USER } }; return Promise.resolve({ data: { session: ses }, error: null }); } },
      realtime: { setAuth: function () {} },
      rpc: function (fn, a) { return post("/rpc/" + fn, a).then(function (j) { return j.error ? { data: null, error: j.error } : { data: j.data, error: null }; }); },
      from: builder,
      channel: function () { var ch = { state: "joined", on: function (t, f, cb) { if (t === "postgres_changes") cbs.push(cb); return ch; }, subscribe: function (cb) { setTimeout(function () { cb && cb("SUBSCRIBED"); }, 0); return ch; }, track: function () {}, presenceState: function () { return {}; } }; return ch; },
      removeChannel: function () {}
    };
  } };
  setInterval(function () { realFetch(SRV + "/v").then(function (r) { return r.json(); }).then(function (j) { if (j.v !== last) { last = j.v; cbs.forEach(function (f) { try { f({ new: null }); } catch (e) {} }); } }).catch(function () {}); }, 250);
})();
