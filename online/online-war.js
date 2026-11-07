/* HRTA Online Multiplayer — หน้าจอเล่นสงครามไพ่ "ยุทธวิธี" 2 คน
 * client แสดงผลอย่างเดียว: กติกา/สุ่ม/จั่ว/ตัดสิน/จับเวลา ทำที่ Edge Function `nn-api` (action war_*)
 * การเลือกพร้อมกันแบบลับ (commit–reveal): ไพ่ที่เลือกถูกส่งขึ้นเซิร์ฟเวอร์และเก็บไว้ลับ อีกฝั่งเห็นแค่ "เลือกแล้ว"
 * เมื่อทั้งคู่ยืนยัน เซิร์ฟเวอร์เปิดไพ่+ตัดสินในครั้งเดียว ฝั่ง client เล่นแอนิเมชันจาก pub.ev (บันทึกเหตุการณ์สาธารณะ)
 * ใช้โต๊ะ/ไพ่ชุดเดียวกับออฟไลน์ (CSS .wt* จาก index.html + รูปไพ่จาก window.__nn.ui / fzCards)
 */
(function () {
  "use strict";
  var X = null;
  var M = { gid: null, myP: -1, shownRs: 0, queue: [], busy: false, sending: false, sel: null, stk: null, raise: false, downs: [], up: null,
    sent: false, tick: null, lastCheck: 0, ready: false, loading: false, resultShown: false, tip: "", logN: 0 };
  var REASON = { timeout: "หมดเวลา", disconnected: "หลุดการเชื่อมต่อ", left: "ออกจากเกม", both_idle: "ไม่มีใครเลือก" };

  function ui() { return (window.__nn && window.__nn.ui) || null; }
  function Q(s) { return document.querySelector(s); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function cards() { try { return window.fzCards ? window.fzCards() : []; } catch (e) { return []; } }
  function tsrc(n) { var u = ui(), t = u && u.TH && u.TH[n]; if (t) return t; var c = cards()[n]; return c ? c.img : ""; }
  function reduce() { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } }
  function sl(ms) { return new Promise(function (r) { setTimeout(r, reduce() ? Math.min(ms, 150) : ms); }); }
  var SPIN = '<div class="onlSpin" role="progressbar" aria-label="กำลังโหลด"></div>';
  function wrap(inner) { return '<div class="onlWrap onlGame wtOnl">' + inner + "</div>"; }
  function nm(pub, p) { return pub.players[p] ? pub.players[p].name : "?"; }

  function ensureThumbs() {
    if (M.ready || M.loading) return;
    M.loading = true;
    var done = function () { if (M.ready) return; M.ready = true; M.loading = false; X.softRender(); };
    try { ui().loadThumbs().then(done, done); } catch (e) { done(); }
    setTimeout(done, 9000);
  }

  /* ---------- การ์ด ---------- */
  function cardH(c, o) {
    o = o || {};
    return '<div class="wtC' + (o.cls ? " " + o.cls : "") + '" data-act="wcard" data-v="' + c.id + '" role="button" tabindex="0" aria-label="ไพ่เลข ' + c.n + '"><div class="im"><img alt="" src="' + esc(tsrc(c.n)) + '"></div><b class="nb">' + c.n + "</b>" +
      (o.tag ? '<i class="tg">' + o.tag + "</i>" : "") + "</div>";
  }
  function faceH(n) { return '<div class="wtC sm"><div class="im"><img alt="" src="' + esc(tsrc(n)) + '"></div><b class="nb">' + n + "</b></div>"; }

  /* ---------- คำบรรยายของเจ้ามือน้องเบสท์ (จากบันทึกเหตุการณ์สาธารณะเท่านั้น) ---------- */
  var LT = {
    win: ["{w} ชนะรอบนี้ ได้ไพ่ {n} ใบค่ะ", "{w} เก็บไพ่ {n} ใบเข้ากอง", "รอบนี้ของ {w} ค่ะ +{n}"],
    war: ["ชนกัน! เปิดสงครามค่ะ กองกลาง {n} ใบ ⚔️", "สงครามเกิดแล้ว! สู้หรือถอยดีคะ กองกลาง {n} ใบ"],
    warEnd: ["ศึกจบ! {w} กวาดกองกลาง {n} ใบ 🎉", "{w} ชนะสงคราม ได้ {n} ใบเลยค่ะ"],
    stack: ["ชนกันอีกแล้ว! ซ้อนศึกชั้น {d} กองกลางโตเป็น {n} ใบ 🔥"],
    ret: ["{l} ถอยค่ะ {w} เก็บ {n} ใบ 🏳️", "{l} ขอถอยตั้งหลัก {w} รับ {n} ใบ"],
    both: ["ถอยทั้งคู่! กองกลาง {n} ใบถูกทิ้ง 🤝"],
    raise: ["{p} เพิ่มเดิมพันค่ะ! ผู้ชนะเก็บทั้งหมด 😮"],
    fool: ["คนโง่ล้มเจ้าโลก! {w} พลิกชนะ 🃏"],
    end: ["จบเกมค่ะ คะแนน {a}:{b}"]
  };
  var lastP = {};
  function pk(k, v) { var a = LT[k], i = 0, n = 0; do { i = Math.floor(Math.random() * a.length); n++; } while (a.length > 1 && lastP[k] === i && n < 6); lastP[k] = i;
    return a[i].replace(/\{(\w+)\}/g, function (m, x) { return v && v[x] != null ? esc(v[x]) : m; }); }
  function say(t) { var e = Q("#woSay"); if (e) e.innerHTML = '<b>🎩 น้องเบสท์ · เจ้ามือ</b> ' + t; }
  function logAdd(t, war) { var ol = Q("#woLog"); if (!ol) return; var li = document.createElement("li"); li.textContent = t.replace(/<[^>]+>/g, ""); if (war) li.className = "war"; ol.insertBefore(li, ol.firstChild); var c = Q("#woLogN"); if (c) c.textContent = "(" + ol.children.length + ")"; }

  /* ---------- วาด ---------- */
  function tableHTML() {
    return '<div class="wtPlay">' +
      '<div class="wtBar"><span id="woRd"></span><span id="woDk"></span><span id="woPl"></span><span id="woDd"></span></div>' +
      '<div class="wtOpp" id="woOpp"></div>' +
      '<div class="wtTbl"><div class="wtSw"><div class="wtSl" id="woS0"></div><span class="wtKk" id="woK0"></span></div><span class="wtVs">VS</span><div class="wtSw"><div class="wtSl" id="woS1"></div><span class="wtKk" id="woK1"></span></div></div>' +
      '<div class="wtPot" id="woPot"></div><div class="wtTip" id="woSay" aria-live="polite"></div><div class="wtTip" id="woTip"></div><div id="woClk" class="onlHint"></div>' +
      '<div class="wtHand" id="woHand"></div><div class="wtAct" id="woAct"></div>' +
      '<details class="wrLogBox"><summary>📜 บันทึกสนามรบ <span id="woLogN"></span></summary><ol id="woLog" reversed></ol></details></div>';
  }
  function slot(i, n, cls) { var e = Q("#woS" + i); if (!e) return; e.className = "wtSl" + (cls ? " " + cls : ""); e.innerHTML = n == null ? "" : faceH(n); }
  function stake(i, n) { var e = Q("#woK" + i); if (e) e.textContent = n != null && n >= 0 ? "➕ เดิมพัน " + n : ""; }
  function clearTable() { slot(0, null); slot(1, null); stake(0, null); stake(1, null); var p = Q("#woPot"); if (p) p.textContent = ""; }
  function opp() { return 1 - M.myP; }

  function paintBar(pub) {
    var me = M.myP, o = opp();
    Q("#woRd").textContent = "รอบ " + pub.round; Q("#woDk").textContent = "🂠 กองจั่ว " + pub.deckN;
    Q("#woPl").textContent = "🏁 " + nm(pub, me) + " " + pub.pileN[me] + " : " + pub.pileN[o] + " " + nm(pub, o); Q("#woDd").textContent = "🗑 ทิ้ง " + pub.discN;
    var n = pub.handN[o], h = "", st = pub.over ? "" : (pub.cm[o] ? "✋ เลือกแล้ว" : (pub.cm[me] ? "🤔 กำลังคิด…" : "…"));
    for (var i = 0; i < n; i++) h += '<div class="wtC bk sm"></div>';
    Q("#woOpp").innerHTML = '<div class="bks">' + h + '</div><span class="st"><b>' + esc(nm(pub, o)) + "</b> · " + st + "</span>";
  }
  function myHand() { return (X.S.hand || []).slice().sort(function (a, b) { return a.n - b.n; }); }
  function lockedNow(pub) { return pub.over || M.busy || M.sending || X.S.busy || pub.cm[M.myP]; }
  function paintHand() {
    var g = X.S.game, pub = g && g.public_state, el = Q("#woHand"), act = Q("#woAct"); if (!pub || !el) return;
    var h = myHand(), lk = lockedNow(pub), war = pub.phase === "war", need = pub.need[M.myP], s = "";
    el.className = "wtHand" + (h.length > 5 ? " many" : "") + (lk ? " lock" : "");
    h.forEach(function (c) {
      var tag = "", cls = "";
      if (!war) { if (M.sel === c.id) { tag = "ลง"; cls = "sel" } else if (M.stk === c.id) { tag = "เดิมพัน"; cls = "stk" } }
      else { if (M.downs.indexOf(c.id) >= 0) { tag = "⬇ คว่ำ"; cls = "sel" } else if (M.up === c.id) { tag = "⭐ ตัดสิน"; cls = "up" } }
      s += cardH(c, { cls: cls, tag: tag });
    });
    el.innerHTML = s;
    var rzLeft = Math.max(0, 2 - (pub.rz ? pub.rz[M.myP] : 0)), b = "";
    if (!pub.over && !lk) {
      if (!war) {
        if (rzLeft > 0 && h.length > 1) b += '<button type="button" class="onlBtn' + (M.raise ? " pri" : "") + '" data-act="wraise">' + (M.raise ? "✅ " : "➕ ") + "เพิ่มเดิมพัน (เหลือ " + rzLeft + ")</button>";
        b += '<button type="button" class="onlBtn pri" data-act="wgo"' + (M.sel == null ? " disabled" : "") + ">✅ ลงไพ่" + (M.stk != null ? " + เดิมพัน" : "") + "</button>";
      } else if (h.length) {
        b += '<button type="button" class="onlBtn" data-act="wretreat">🏳️ ถอย (เสีย ' + pub.potN + ' ใบ)</button>';
        b += '<button type="button" class="onlBtn pri" data-act="wgo"' + (M.downs.length === need && M.up != null ? "" : " disabled") + ">⚔️ ลุย!</button>";
      }
    }
    act.innerHTML = b;
    var tip = Q("#woTip");
    if (tip) tip.textContent = pub.over ? "" : lk ? (pub.cm[M.myP] ? "ยืนยันแล้ว รออีกฝั่งเลือก…" : "") :
      war ? (h.length ? "แตะไพ่ " + need + " ใบเป็นไพ่คว่ำ (⬇) แล้วแตะอีกใบเป็นใบตัดสิน (⭐) หรือกดถอย · กองกลาง " + pub.potN + " ใบ" : "ไพ่หมดมือ — ศึกนี้ตัดสินอัตโนมัติ") :
      "แตะไพ่เพื่อเลือกลง แล้วกดยืนยัน · อีกฝั่งจะไม่เห็นว่าเลือกอะไรจนกว่าทั้งคู่ยืนยัน";
  }
  function paintAll() {
    var g = X.S.game, pub = g && g.public_state; if (!pub || !Q("#woHand")) return;
    paintBar(pub); paintHand();
  }

  /* ---------- แอนิเมชันจากบันทึกเหตุการณ์ ---------- */
  async function show(pub, evs) {
    M.busy = true; paintHand();
    try {
      for (var i = 0; i < evs.length; i++) {
        var e = evs[i], m = "";
        if (e.t === "flip") { clearTable(); slot(0, e.up[M.myP]); slot(1, e.up[opp()]); stake(0, e.stk[M.myP]); stake(1, e.stk[opp()]);
          var os = e.stk[opp()]; if (os >= 0) { say(pk("raise", { p: nm(pub, opp()) })); logAdd(nm(pub, opp()) + " เพิ่มเดิมพัน"); } else if (e.stk[M.myP] >= 0) logAdd("คุณเพิ่มเดิมพัน");
          logAdd("รอบ " + e.r + ": คุณ " + e.up[M.myP] + " ต่อ " + e.up[opp()] + " " + nm(pub, opp())); try { ui().nsfx("flip"); } catch (x) {} await sl(900); }
        else if (e.t === "fool") { say(pk("fool", { w: nm(pub, e.p) })); logAdd("🃏 คนโง่ล้มเจ้าโลก! " + nm(pub, e.p) + " ชนะ"); await sl(700); }
        else if (e.t === "war") { m = e.d > 1 ? pk("stack", { d: e.d, n: e.pot }) : pk("war", { n: e.pot }); say(m); logAdd("⚔️ ชนกัน! ซ้อนศึกชั้น " + e.d + " · กองกลาง " + e.pot + " ใบ", true); var pt = Q("#woPot"); if (pt) pt.textContent = "🎴 กองกลาง " + e.pot; await sl(900); }
        else if (e.t === "lay") { slot(0, e.ups[M.myP], "war"); slot(1, e.ups[opp()], "war"); var pt2 = Q("#woPot"); if (pt2) pt2.textContent = "🎴 กองกลาง " + e.pot; logAdd("ใบตัดสิน: คุณ " + e.ups[M.myP] + " ต่อ " + e.ups[opp()] + " " + nm(pub, opp()), true); await sl(1000); }
        else if (e.t === "res") { var a = Q("#woS" + (e.w === M.myP ? 0 : 1)), b = Q("#woS" + (e.w === M.myP ? 1 : 0)); if (a) a.classList.add("win"); if (b) b.classList.add("lose");
          m = e.war ? pk("warEnd", { w: nm(pub, e.w), n: e.n }) : pk("win", { w: nm(pub, e.w), n: e.n }); say(m); logAdd(m, !!e.war); await sl(1100); }
        else if (e.t === "ret") { m = e.both ? pk("both", { n: e.n }) : pk("ret", { l: nm(pub, e.p), w: nm(pub, e.w), n: e.n }); say(m); logAdd(m, true); await sl(1100); }
      }
    } finally { M.busy = false; }
  }
  async function pump() {
    if (M.busy) return;
    var g = X.S.game; if (!g) return;
    while (M.queue.length) {
      var b = M.queue.shift(), pub = g.public_state;
      M.sel = null; M.stk = null; M.raise = false; M.downs = []; M.up = null; M.sent = false;
      await show(pub, b.ev);
      g = X.S.game || g;
      paintAll();
    }
    var pub2 = X.S.game && X.S.game.public_state;
    if (pub2 && pub2.over && !M.queue.length) showResult();
  }

  /* ---------- ผลเกม ---------- */
  function resultHTML(pub) {
    var r = pub.res || { w: -1, a: 0, b: 0 }, me = M.myP, host = X.isHost(), bd = X.S.busy ? " disabled" : "", big, title, msg;
    var mineS = pub.pileN[me], oppS = pub.pileN[1 - me];
    if (r.why === "forfeit") { var fo = r.forfeit; big = fo === me ? "😵" : "🎉"; title = esc(nm(pub, fo)) + " " + (REASON[r.reason] || "ยอมแพ้") + " — ถือว่ายอมแพ้"; msg = fo === me ? "คุณแพ้ในศึกนี้ ลองใหม่ได้เสมอค่ะ" : "คุณชนะ! ฝ่ายตรงข้ามยอมแพ้"; }
    else if (r.why === "abandoned") { big = "🤝"; title = "ไม่มีใครเลือก — จบเกมแบบเสมอ"; msg = "ทั้งสองฝั่งไม่ได้เลือกไพ่ในเวลาที่กำหนด"; }
    else if (r.w < 0) { big = "🤝"; title = "เสมอ " + mineS + " : " + oppS; msg = "สูสีสุด ๆ ค่ะ"; }
    else { var iw = r.w === me; big = iw ? "🏆" : "😵"; title = esc(nm(pub, r.w)) + " ชนะ " + pub.pileN[r.w] + " : " + pub.pileN[1 - r.w]; msg = iw ? "คุณชนะ! วางแผนได้เฉียบขาด" : "คุณแพ้ในศึกนี้ ลองใหม่ได้เสมอค่ะ"; }
    return '<div class="nnRes"><div class="big">' + big + "</div><h3>" + title + "</h3><p>" + msg + '</p><p class="nnD">รวม ' + pub.round + ' รอบ</p><p class="nnD">โหมดออนไลน์ยังไม่มีรางวัลเหรียญ</p>' +
      (host ? '<button type="button" class="nnBt" data-act="rematch"' + bd + ">🔁 เล่นอีกครั้ง (Rematch)</button>" : '<p class="nnD">รอ Host กดเล่นอีกครั้ง…</p>') +
      '<button type="button" class="nnBt alt" data-act="leave">🚪 ออกจากห้อง</button>' + (host ? '<button type="button" class="nnBt alt" data-act="close">ปิดห้อง</button>' : "") + "</div>";
  }
  function showResult() {
    var g = X.S.game; if (!g || M.resultShown || M.busy || M.queue.length) return;
    var pub = g.public_state; if (!pub.over) return;
    M.resultShown = true; clearInterval(M.tick); M.tick = null;
    var body = Q("#woBody"); if (body) body.innerHTML = resultHTML(pub);
    var foot = Q("#woFoot"); if (foot) foot.innerHTML = "";
    try { var r = pub.res || {}; ui().nsfx(r.w === M.myP ? "win" : "boom"); } catch (e) {}
  }

  /* ---------- นาฬิกา 60 วินาที + เรียก check เมื่อหมดเวลา ---------- */
  function tick() {
    var g = X.S.game;
    if (!g || !Q("#woHand")) { clearInterval(M.tick); M.tick = null; return; }
    var pub = g.public_state; if (pub.over) return;
    var rem = Date.parse(g.turn_deadline_at) - (Date.now() + X.skew()), c = Q("#woClk");
    if (c && isFinite(rem)) c.textContent = (pub.cm[M.myP] ? "⏳ รออีกฝั่ง " : "⏱ เหลือเวลาเลือก ") + Math.max(0, Math.ceil(rem / 1000)) + " วินาที";
    if (isFinite(rem) && rem < -1500 && !M.busy && Date.now() - M.lastCheck > 8000 && X.S.net) {
      M.lastCheck = Date.now();
      setTimeout(function () { X.callApi({ action: "war_check", game_id: g.id }).then(function () { return X.refetch(); }).catch(function () {}); }, Math.random() * 1500);
    }
  }

  /* ---------- วาด/อัปเดต (เรียกจาก online.js render) ---------- */
  function mount(root, g, pub, me) {
    M.gid = g.id; M.myP = -1; pub.players.forEach(function (pl, p) { if (pl.seat === me.seat) M.myP = p; });
    M.shownRs = pub.rs || 0; M.queue = []; M.busy = false; M.sending = false; M.sel = null; M.stk = null; M.raise = false; M.downs = []; M.up = null; M.resultShown = false; M.sent = !!(pub.cm && pub.cm[M.myP]);
    root.innerHTML = wrap('<div id="woBan"></div><div id="woBody">' + (pub.over ? resultHTML(pub) : tableHTML()) + '</div><div id="woFoot"></div>');
    if (pub.over) { M.resultShown = true; return; }
    clearInterval(M.tick); M.tick = setInterval(tick, 1000);
    Q("#woFoot").innerHTML = '<button type="button" class="onlX lv" data-act="leave">ออกจากห้อง (ถือว่ายอมแพ้)</button>';
    say("ยุทธวิธี! เลือกไพ่หนึ่งใบแล้วกดยืนยัน อีกฝั่งจะไม่เห็นจนกว่าทั้งคู่ยืนยันนะคะ 🃏");
    if (pub.ev && pub.ev.length && pub.round > 0) { var fl = pub.ev.filter(function (e) { return e.t === "flip" })[0]; if (fl) { slot(0, fl.up[M.myP]); slot(1, fl.up[opp()]); } }
    paintAll();
  }
  function render(root) {
    var S = X.S, g = S.game, me = X.mine(), u = ui();
    if (!u) { root.innerHTML = wrap(X.top("🧠 สงครามไพ่ยุทธวิธี") + "<p>โหลดชุดแสดงผลเกมไม่สำเร็จ ลองรีเฟรชหน้าเว็บ</p>"); return true; }
    if (!g || !me || !S.hand) { M.gid = null; root.innerHTML = wrap(X.top("🧠 สงครามไพ่ยุทธวิธี") + SPIN); return true; }
    if (!M.ready) { ensureThumbs(); M.gid = null; root.innerHTML = wrap(X.top("🧠 สงครามไพ่ยุทธวิธี") + SPIN + '<p class="onlHint">กำลังโหลดไพ่…</p>'); return true; }
    var pub = g.public_state;
    if (M.gid !== g.id || !(root.querySelector("#woHand") || root.querySelector(".nnRes"))) mount(root, g, pub, me);
    var ban = root.querySelector("#woBan"); if (ban) ban.innerHTML = X.banner();
    if ((pub.rs || 0) > M.shownRs) {            // มีการเปิดไพ่ครั้งใหม่ → เข้าคิวเล่นแอนิเมชัน
      M.shownRs = pub.rs; M.queue.push({ ev: pub.ev || [] }); pump();
    } else if (root.querySelector("#woHand") && !M.busy) { paintAll(); if (pub.over) showResult(); }
    else if (root.querySelector(".nnRes")) { var b = root.querySelector("#woBody"); if (b && pub.over) b.innerHTML = resultHTML(pub); }
    return true;
  }

  /* ---------- การกระทำ ---------- */
  function send(choice) {
    var S = X.S, g = S.game; if (!g || M.busy || M.sending || S.busy) return;
    M.sending = true; M.sent = true; paintHand();
    X.run(async function () {
      try {
        var full = { action: "war_choose", game_id: g.id, request_id: X.uuid(), expected_version: g.version, choice: choice }, res = null, tries = 0;
        while (true) {
          try { res = await X.callApi(full); }
          catch (e) { if (++tries > 3) throw e; await new Promise(function (r) { setTimeout(r, 700 * tries); }); continue; }   // เน็ตหลุด: ส่งซ้ำด้วย request_id เดิมได้ปลอดภัย
          if (res.error === "stale") {            // อีกฝั่งยืนยันไปก่อน เวอร์ชันเลื่อน → โหลดใหม่แล้วส่งด้วยเวอร์ชันล่าสุด (ถ้ายังไม่เคยเลือก)
            await X.refetch(); var ng = X.S.game;
            if (!ng || ng.public_state.cm[M.myP] || ++tries > 3) break;
            full.expected_version = ng.version; full.request_id = X.uuid(); continue;
          }
          break;
        }
        if (res && res.error === "stale") { await X.refetch(); return; }
        if (res && res.error) throw new Error(res.error);
        await X.refetch();
      } catch (e) { M.sent = false; throw e; }
      finally { M.sending = false; paintHand(); }
    });
  }
  function onClick(a, v) {
    var g = X.S.game, pub = g && g.public_state;
    if (a === "wcard") {
      if (!pub || lockedNow(pub)) return true;
      var id = +v;
      if (pub.phase === "play") { if (M.raise && M.sel != null && id !== M.sel) M.stk = (M.stk === id ? null : id); else { if (M.stk === id) M.stk = null; M.sel = (M.sel === id ? null : id); } }
      else { var i = M.downs.indexOf(id), need = pub.need[M.myP]; if (i >= 0) M.downs.splice(i, 1); else if (M.up === id) M.up = null; else if (M.downs.length < need) M.downs.push(id); else M.up = id; }
      paintHand(); return true;
    }
    if (a === "wraise") { if (!pub || lockedNow(pub)) return true; M.raise = !M.raise; if (!M.raise) M.stk = null; paintHand(); var t = Q("#woTip"); if (t && M.raise) t.textContent = M.sel == null ? "เลือกไพ่ที่จะลงก่อน แล้วแตะไพ่อีกใบเป็นเดิมพัน" : "แตะไพ่อีกใบเป็นเดิมพัน (ผู้ชนะเก็บทั้งหมด)"; return true; }
    if (a === "wgo") {
      if (!pub || lockedNow(pub)) return true;
      if (pub.phase === "play" && M.sel != null) { var ch = { c: M.sel }; if (M.stk != null) ch.x = M.stk; send(ch); }
      else if (pub.phase === "war" && M.downs.length === pub.need[M.myP] && M.up != null) send({ down: M.downs.slice(), up: M.up });
      return true;
    }
    if (a === "wretreat") { if (pub && !lockedNow(pub) && pub.phase === "war") send({ r: 1 }); return true; }
    if (a === "rematch") { X.run(async function () { await X.rpc("nn_rematch", { p_room: X.S.rid }); await X.refetch(); }); return true; }
    return false;
  }
  function reset() { if (!M.gid && !M.tick) return; clearInterval(M.tick); M.tick = null; M.gid = null; M.queue = []; M.busy = false; M.sending = false; }

  window.WarOnline = { init: function (x) { X = x; }, render: render, onClick: onClick, reset: reset };
})();
