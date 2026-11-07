// ตัวจำลอง Supabase สำหรับ e2e ของ Quiz leaderboard — เลียนพฤติกรรมของ quiz_submit / quiz_leaderboard ใน 007_quiz_leaderboard.sql
(function () {
  var DB = {}, LOG = [], ME = "33333333-3333-4333-8333-333333333333";
  window.__QDB = DB; window.__QFAIL = false; window.__QCALLS = [];
  function clean(n) { return String(n || "").replace(/[<>&"'`\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim().slice(0, 40); }
  var rpcs = {
    quiz_submit: function (a) {
      var nm = clean(a.p_name);
      if (!nm) throw new Error("bad_name"); if (!Number.isInteger(a.p_score) || a.p_score < 0 || a.p_score > 20) throw new Error("bad_score");
      var now = Date.now(); LOG = LOG.filter(function (t) { return now - t < 3600e3; }); if (LOG.length >= 30) throw new Error("rate_limited"); LOG.push(now);
      var r = DB[nm];
      if (!r) r = DB[nm] = { name: nm, best: a.p_score, last: a.p_score, plays: 1, total: a.p_score, at: now };
      else { r.best = Math.max(r.best, a.p_score); r.last = a.p_score; r.plays++; r.total += a.p_score; r.at = now; }
      return { name: nm, best: r.best, plays: r.plays };
    },
    quiz_leaderboard: function () {
      return Object.keys(DB).map(function (k) { var r = DB[k]; return { name: r.name, best: r.best, last: r.last, plays: r.plays, avg: Math.round(r.total / r.plays * 10) / 10, at: r.at }; })
        .sort(function (a, b) { return b.best - a.best || a.plays - b.plays || a.at - b.at; }).slice(0, 100);
    }
  };
  var ses = null;
  window.supabase = { createClient: function () {
    return {
      auth: { getSession: function () { return Promise.resolve({ data: { session: ses } }); },
        signInAnonymously: function () { ses = { access_token: "t", user: { id: ME } }; return Promise.resolve({ data: { session: ses }, error: null }); } },
      realtime: { setAuth: function () {} },
      rpc: function (fn, a) {
        window.__QCALLS.push(fn);
        if (window.__QFAIL) return Promise.reject(new TypeError("Failed to fetch"));
        try { return Promise.resolve({ data: JSON.parse(JSON.stringify(rpcs[fn](a || {}))), error: null }); }
        catch (e) { return Promise.resolve({ data: null, error: { message: e.message } }); }
      }
    };
  } };
})();
