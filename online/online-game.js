/* HRTA Online Multiplayer — หน้าจอเล่นเกม (Phase 2/3)
 * ใช้ "โต๊ะ/ไพ่/เอฟเฟกต์/เสียง" ชุดเดียวกับโหมดออฟไลน์ (markup + CSS .nn* + ฟังก์ชันแสดงผลที่ index.html ส่งออกใน window.__nn.ui)
 * client แสดงผลอย่างเดียว: กติกา/สุ่ม/จั่ว/ตัดสิน/จับเวลา ทำที่ Edge Function `nn-api`
 * การอัปเดตจากเซิร์ฟเวอร์เข้าเป็น "คิว action" แล้วเล่นแอนิเมชันทีละตาเหมือนออฟไลน์ (บิน→กอง→นับเลข→เอฟเฟกต์)
 */
(function () {
  "use strict";
  var X = null;
  var M = {
    gid: null, n: 0, cap: 0, two: false, myP: -1, order: [], names: [], avatars: [], pile: [],
    shownSeq: -1, shownTotal: 0, capSeq: -2, queue: [], queued: {}, busy: false, sel: null, rc: null, sending: false,
    ready: false, loading: false, tick: null, lastCheck: 0, resultShown: false, fs: false, mode: "one_loser"
  };

  function ui() { return (window.__nn && window.__nn.ui) || null; }
  function Q(s) { return document.querySelector(s); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function cards() { try { return window.fzCards ? window.fzCards() : []; } catch (e) { return []; } }
  function cn(n) { var c = cards()[n]; return c ? c.n : "เลข " + n; }
  function tsrc(n) { var u = ui(), t = u && u.TH[n]; if (t) return t; var c = cards()[n]; return c ? c.img : ""; }   // ย่อรูปไม่สำเร็จ → ใช้รูปเต็มแทน (ไม่ปล่อยว่าง)
  function sl(x) { return new Promise(function (r) { setTimeout(r, ui().ms(x)); }); }
  function pickAv(pl) { var u = ui(); return u.ph(pl.avatar) || u.photoFor(pl.name) || ""; }
  function wrap(inner) { return '<div class="onlWrap onlGame">' + inner + "</div>"; }
  var SPIN = '<div class="onlSpin" role="progressbar" aria-label="กำลังโหลด"></div>';

  function ensureThumbs() {
    if (M.ready || M.loading) return;
    M.loading = true;
    var done = function () { if (M.ready) return; M.ready = true; M.loading = false; X.softRender(); };
    try { ui().loadThumbs().then(done, done); } catch (e) { done(); }
    setTimeout(done, 9000);                      // กันค้าง: ถ้าโหลดช้ามาก แสดงด้วยรูปเต็มไปก่อน
  }

  /* ---------- ตัวเลือก/ข้อความของไพ่ ใช้ engine ตัวเดียวกับเซิร์ฟเวอร์ ---------- */
  function optsFor(pub, n) {
    var G = window.NNEngine.engine({ cap: pub.cap, n: pub.n });
    G.total = pub.total; G.prev = pub.prev;
    return G.opts(n);
  }

  /* ---------- ตัวเลข/กอง/คำบรรยาย (เหมือน setNum/paintPile/setCap ของออฟไลน์) ---------- */
  function setNum(v) {
    var e = Q("#nnNum"); if (!e) return;
    e.textContent = Math.round(v);
    var pc = Math.min(100, v / M.cap * 100), b = Q("#nnBarI");
    b.style.width = pc + "%"; b.style.background = pc < 60 ? "#6aa84f" : pc < 85 ? "#e0a020" : "#d04a2a";
    Q("#nnNumW").classList.toggle("hot", M.cap - v <= 15);
  }
  function countTo(a, b, dur) {
    var u = ui();
    return new Promise(function (res) {
      var t0 = performance.now(), last = -1;
      (function f(t) {
        var k = Math.min(1, (t - t0) / dur), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2, v = a + (b - a) * e;
        setNum(v);
        if (Math.round(v) !== last && k < 1) { last = Math.round(v); if (!(last % 3)) u.nsfx("tick"); }
        if (k < 1) requestAnimationFrame(f); else { setNum(b); res(); }
      })(t0);
    });
  }
  function paintPile() {
    var e = Q("#nnPile"); if (!e) return;
    e.innerHTML = M.pile.length ? M.pile.map(function (c) {
      return '<img alt="" src="' + tsrc(c.n) + '" style="transform:rotate(' + c.r + "deg) translate(" + c.x + 'px,0)">';
    }).join("") : '<div class="em"></div>';
  }
  function nm(p) { return M.names[p] || "?"; }
  function extras(r) {
    var a = [];
    if (r.heat) a.push("🔥 ไฟลามทุ่ง +" + r.heat);
    if (r.saved) a.push("🛡️ โล่แตก! กองถูกกดเหลือ " + r.after);
    if (r.fx === "shield") a.push("🛡️ " + nm(r.p) + " ได้โล่ 1 ชั้น");
    if (r.fx === "all") a.push("ทุกคนทิ้งไพ่เลขสูงสุด จั่วใหม่");
    if (r.fx === "swap") a.push("สลับมือกับ " + nm(r.nx));
    if (r.fx === "devil") a.push(nm(r.nx) + " ต้องลงติดกัน 2 ใบ!");
    if (r.fx === "conj") a.push(nm(r.nx) + " โดนเสกไพ่ปีศาจใส่มือ!");
    if (r.fx === "rob") a.push(nm(r.nx) + " ถูกริบไพ่เลขต่ำสุด");
    if (r.fx === "force") a.push(nm(r.nx) + " ต้องลงใบเลขสูงสุด!");
    if (r.fx === "skip") a.push("ข้าม " + nm(r.nx));
    if (r.fx === "rev") a.push("ย้อนทิศ!");
    if (r.fx === "fool") a.push(M.two ? "รีเซ็ตมือ" : "รีเซ็ตทิศ");
    if (r.fx === "again") a.push(nm(r.p) + " ลงซ้ำอีกใบ");
    return a.join(" · ");
  }
  var REASON = { timeout: "หมดเวลา", disconnected: "หลุดการเชื่อมต่อนานเกินไป", left: "ออกจากเกม" };
  function setCap(r) {
    var e = Q("#nnCap"); if (!e) return;
    if (r.forfeit) {
      e.innerHTML = "<div><b>" + esc(nm(r.p)) + "</b> " + REASON[r.reason] + " — ถือว่ายอมแพ้</div>";
    } else {
      var d = r.after - r.before, ex = extras(r);
      e.innerHTML = "<div><b>" + esc(nm(r.p)) + "</b> ลง <b>" + esc(cn(r.n)) + "</b> (" + r.n + ")</div><div><span class=\"chip " + (d > 0 ? "up" : d < 0 ? "dn" : "") + '">' +
        (d >= 0 ? "+" : "−") + Math.abs(d) + "</span> " + esc(r.t) + " · กอง " + r.before + " → <b>" + r.after + "</b></div>" + (ex ? '<div class="ex">' + esc(ex) + "</div>" : "");
    }
    e.classList.remove("pulse"); void e.offsetWidth; e.classList.add("pulse");
    M.capSeq = r.seq;
  }

  /* ---------- โต๊ะ (markup เดียวกับ buildTable ของออฟไลน์) ---------- */
  function seatHTML(i) {
    var u = ui(), n = M.n, pos = u.POS[n][i], p = M.order[i], img = M.avatars[p];
    return '<div class="nnSeat s-' + pos + '" id="nnS' + i + '"><div class="av">' + (img ? '<img alt="" src="' + esc(img) + '">' : ["🧑", "👩", "🧔", "👧"][i]) + "</div><b>" + esc(nm(p)) +
      '</b><div class="bk"><i></i><i></i><i></i></div><u class="sh" hidden>🛡️</u><span class="th" hidden>💭</span></div>';
  }
  function tableHTML() {
    var u = ui(), n = M.n, h = '<div class="nnT n' + n + '" id="nnT"><div class="nnCtl"><button type="button" data-act="nrules" aria-label="กติกาและพลังไพ่">📖</button>' +
      '<button type="button" data-act="nspd" id="nnSpd" aria-label="ความเร็ว">' + u.SPL[u.PF.spd] + "</button>" +
      (n >= 3 ? '<button type="button" data-act="nfs" aria-label="เต็มจอ">⛶</button>' : "") + '<button type="button" data-act="nhide" aria-label="ย่อหน้าต่างเกม">✕</button></div>';
    for (var i = 1; i < n; i++) h += seatHTML(i);
    h += '<div class="nnCtr"><div class="nnPile" id="nnPile"></div><div class="nnNB"><div class="nnNumW" id="nnNumW"><b id="nnNum">0</b><span id="nnCapN">/ ' + M.cap +
      '</span></div><div class="nnBarX"><i id="nnBarI"></i></div><div class="nnCap" id="nnCap">เกมเริ่มแล้ว — กองกลางเริ่มที่ 0 · แตะไพ่ในมือเพื่อดูพลัง</div><div class="nnDir" id="nnDir"></div></div>' +
      '<div class="nnSay"><img id="nnSayI" alt="" src=""><div><small id="nnSayN"></small><span id="nnSayT"></span></div></div></div>' +
      '<div class="nnHW" id="nnHand"></div><div class="nnFx" id="nnFx"></div><div class="nnRules" id="nnRules" hidden></div></div>';
    return h;
  }
  function rulesHTML(pub) {
    var h = '<h3>📖 กติกา · พลังไพ่</h3><p class="nnD">แจกคนละ 3 ใบ ผลัดกันลง 1 ใบแล้วจั่ว 1 ใบ แต้มเท่าเลขบนไพ่ บวกเข้ากองกลาง ใครทำให้กองเกิน <b>' + pub.cap +
      "</b> แพ้ · พลังไพ่ด้านล่างเป็นของโหมด " + pub.n + " คน · ตาละ 60 วินาที หมดเวลา/หลุดนาน/ออกจากเกม = แพ้" + (pub.mode === "elimination" ? " · โหมดคัดออก: ใครทำกองเกินตกรอบ กองรีเซ็ต เล่นต่อจนเหลือคนสุดท้าย" : "") + "</p>";
    for (var n = 0; n < 22; n++) h += '<div class="nnRw"><img alt="" src="' + tsrc(n) + '"><b>' + n + "</b><div><u>" + esc(cn(n)) + "</u><br>" + esc(ui().desc(n, pub.two, pub.cap)) + "</div></div>";
    return h + '<button type="button" data-act="nrulesx">ปิด</button>';
  }

  /* ---------- มือไพ่ (เหมือน paintHand ของออฟไลน์) ---------- */
  function myTurn(pub) { return pub.over < 0 && pub.cur === M.myP; }
  function paintHand() {
    var e = Q("#nnHand"), g = X.S.game, hand = X.S.hand; if (!e || !g || !hand) return;
    var u = ui(), pub = g.public_state, me = M.myP, can = myTurn(pub) && !isOut(pub, M.myP) && !M.busy && !M.sending && !X.S.busy;
    var pic = M.avatars[me], forced = pub.force === me;
    var mx = -1; hand.forEach(function (c) { if (c.n > mx) mx = c.n; });
    var out = isOut(pub, me);
    var status = pub.over >= 0 ? "จบเกม" : out ? "ตกรอบแล้ว — ดูเพื่อนเล่นต่อ" : myTurn(pub) ? (M.sending ? "กำลังลงไพ่…" : "ตาของคุณ") : "รอ " + esc(nm(pub.cur)) + "…";
    var hdr = '<div class="nnHdr">' + (pic ? '<img class="hav" alt="" src="' + esc(pic) + '"> ' : "🧑 ") + "<b>" + esc(nm(me)) + "</b>" + (pub.shield[me] ? " 🛡️" : "") + " · " + status +
      (forced ? " · ⛓️ ถูกบังคับลงใบเลขสูงสุด" : "") + (pub.dbl && pub.dbl.p === me ? " · ✌️ ลง 2 ใบติดกัน (เหลือ " + pub.dbl.left + ")" : "") + "</div>";
    var sel = null; hand.forEach(function (c) { if (c.id === M.sel) sel = c; });
    if (M.sel != null && !sel) M.sel = null;
    var cardsH = '<div class="nnHd">' + hand.map(function (c) {
      var lock = forced && c.n !== mx, os = optsFor(pub, c.n).map(function (o) { return esc(o.t); }).join(" / ");
      return '<button type="button" class="nnC' + (sel && sel.id === c.id ? " on" : "") + ((can && !lock) ? "" : " dim") + '" data-act="ncard" data-v="' + c.id + '"><img alt="' + esc(cn(c.n)) +
        '" src="' + tsrc(c.n) + '"><b>' + c.n + "</b><small>" + os + "</small></button>";
    }).join("") + "</div>";
    var ok = !!sel && !(forced && sel.n !== mx), act = "";
    if (can && ok) act = '<div class="nnAct">' + optsFor(pub, sel.n).map(function (o, k) {
      var heat = pub.heat || 0, t = (o.set != null ? o.set : Math.max(0, pub.total + o.v)) + heat, w = o.fx === "wheel", bad = !w && t > pub.cap && !pub.shield[me];
      return '<button type="button" data-act="nopt" data-v="' + k + '" class="' + (bad ? "bad" : "") + '">' + esc(o.t) + ((o.set != null || w) ? "" : " → " + t) + (bad ? " 💥" : "") + "</button>";
    }).join("") + "</div>";
    var ds = sel ? "<b>" + esc(cn(sel.n)) + "</b> · " + esc(u.desc(sel.n, pub.two, pub.cap)) + (!ok ? "<br>⛓️ ใบนี้ลงไม่ได้ ต้องลงใบเลขสูงสุด" : "") : "แตะไพ่เพื่อดูพลังพิเศษ" + (can ? " แล้วเลือกลง" : "");
    e.innerHTML = hdr + '<div class="nnDs">' + ds + '</div><div class="nnRow">' + cardsH + act + "</div>";
  }

  function paintSay(pub) {
    var g = X.S.game; if (!g) return;
    var i = Q("#nnSayI"), n = Q("#nnSayN"), t = Q("#nnSayT"); if (!i) return;
    var p = pub.cur, over = pub.over >= 0;
    i.src = M.avatars[p] || ""; i.style.visibility = M.avatars[p] ? "visible" : "hidden";
    n.textContent = over ? "จบเกม" : nm(p) + (p === M.myP ? " (คุณ)" : "");
    var rem = Math.ceil((Date.parse(g.turn_deadline_at) - (Date.now() + X.skew())) / 1000), txt;
    if (over) txt = "";
    else {
      txt = (p === M.myP ? "ถึงตาคุณ — เลือกไพ่แล้วกดลง" : "กำลังคิดว่าจะลงใบไหน…");
      if (isFinite(rem)) txt += " · ⏱ " + Math.max(0, rem) + " วิ";
      var rp = X.S.players.filter(function (x) { return x.seat === pub.players[p].seat; })[0];
      if (rp && rp.user_id !== X.S.uid && X.S.link === "ok" && Object.keys(X.S.online).length && !X.S.online[rp.user_id]) txt += " · 📴 หลุดการเชื่อมต่อ (รอได้สูงสุด 2 นาที)";
    }
    t.textContent = txt; t.style.color = (!over && isFinite(rem) && rem <= 10) ? "#c0392b" : "";
  }
  function isFinal(l) { var g = X.S.game, pub = g && g.public_state; return !!(pub && pub.over >= 0 && pub.last && pub.last.seq === l.seq); }
  function isOut(pub, p) { return !!pub.alive && pub.alive.indexOf(p) < 0; }
  function paintAll(pub) {
    var over = pub.over >= 0; M.two = pub.two;
    for (var i = 1; i < M.n; i++) {
      var p = M.order[i], s = Q("#nnS" + i); if (!s) continue;
      s.classList.toggle("act", pub.cur === p && !over && !isOut(pub, p));
      s.classList.toggle("out", isOut(pub, p));
      var tg = s.querySelector(".outTag"); if (isOut(pub, p) && !tg) { tg = document.createElement("em"); tg.className = "outTag"; tg.textContent = "ตกรอบ"; s.appendChild(tg); } else if (!isOut(pub, p) && tg) tg.remove();
      s.querySelector(".sh").hidden = !pub.shield[p];
      s.querySelector(".th").hidden = !(pub.cur === p && !over && !isOut(pub, p));
      s.querySelectorAll(".bk i").forEach(function (el, k) { el.style.visibility = k < pub.handCounts[p] ? "visible" : "hidden"; });
    }
    setNum(pub.total); M.shownTotal = pub.total;
    var d = Q("#nnCapN"); if (d) d.textContent = "/ " + pub.cap + (pub.n > 2 ? (pub.dir > 0 ? " ↻" : " ↺") : "") + (pub.heat ? " 🔥+" + pub.heat : "");
    paintPile();
    if (pub.last && M.capSeq !== pub.last.seq) setCap(pub.last);
    paintSay(pub);
    paintHand();
  }

  /* ---------- แอนิเมชันต่อ 1 action (ลำดับเดียวกับ doPlay ออฟไลน์) ---------- */
  function rnd(a) { return Math.round((Math.random() - .5) * a); }
  async function animate(l) {
    var u = ui(), p = l.p, i = M.order.indexOf(p);
    if (l.forfeit) {
      setCap(l); u.nsfx("boom"); u.banner("🏳️ " + nm(p) + (l.elim != null && M.mode === "elimination" ? " ตกรอบ" : " ยอมแพ้"), REASON[l.reason], 1800); u.shake();
      await sl(1700); return;
    }
    setNum(l.before);
    var rc = (p === M.myP && M.rc) ? M.rc : (i > 0 && Q("#nnS" + i + " .av") ? u.rectOf(Q("#nnS" + i + " .av")) : u.rectOf(Q("#nnHand")));
    M.rc = null;
    await u.fly(rc, { n: l.n }, 750);
    M.pile.push({ n: l.n, r: rnd(20), x: rnd(6) }); if (M.pile.length > 3) M.pile.shift();
    paintPile(); setCap(l);
    var spc = [0, 1, 2, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21].indexOf(l.n) >= 0 || l.saved || l.bust;
    u.nsfx(spc ? "pow" : "play");
    var w = u.pre({ c: { n: l.n } }); if (w) await sl(w);
    var d = l.after - l.before; u.pop((d >= 0 ? "+" : "−") + Math.abs(d), d > 0 ? "#ff8a80" : "#a5d6a7");
    await countTo(l.before, l.after, u.ms(l.n === 16 || l.n === 21 || l.saved ? 1600 : 1000));
    if (l.bust) { u.burst("💥", 10); u.flash("#f44", 700); u.shake(); }
    M.shownTotal = l.after;
    await sl(spc ? 1300 : 800);
    if (l.bust) await sl(400);
    if (l.bust && M.mode === "elimination" && l.elim != null && !isFinal(l)) {      // คัดออกกลางเกม: ประกาศ + กองรีเซ็ต
      u.banner("💥 " + nm(p) + " ตกรอบ!", "กองกลางรีเซ็ตเป็น 0", 1800); await sl(1500);
    }
  }

  function pump() {
    if (M.busy) return;
    var g = X.S.game; if (!g || !Q("#nnT")) return;
    if (M.queue.length) {
      var l = M.queue.shift(); M.busy = true; paintHand();
      animate(l).catch(function () {}).then(function () { M.shownSeq = Math.max(M.shownSeq, l.seq); M.busy = false; pump(); });
      return;
    }
    var pub = g.public_state;
    paintAll(pub);
    if (pub.over >= 0 && !M.resultShown) setTimeout(showResult, 300);
  }

  /* ---------- หน้าผลลัพธ์ (ข้อความตามออฟไลน์) ---------- */
  function resultHTML(pub) {
    var x = pub.over, last = pub.last || {}, me = M.myP, fo = last.forfeit, host = X.isHost(), bd = X.S.busy ? " disabled" : "";
    var big, title, msg, ranks = "";
    if (pub.mode === "elimination" && pub.winner != null) {
      var order = [pub.winner].concat(pub.out.slice().reverse()), medal = ["🥇", "🥈", "🥉", "4️⃣"], mine = order.indexOf(me) + 1;
      big = mine === 1 ? "🏆" : "😵";
      title = esc(nm(pub.winner)) + " คือผู้ชนะ!";
      msg = mine === 1 ? "คุณชนะ! เหลือรอดคนสุดท้าย" : "คุณได้อันดับ " + mine + " จาก " + order.length;
      ranks = '<p class="nnD">' + order.map(function (o, i) { return medal[i] + " " + esc(nm(o)); }).join(" · ") + "</p>";
    } else {
      var iLost = x === me, loser = nm(x);
      var winners = pub.players.filter(function (pl) { return pl.p !== x; }).map(function (pl) { return esc(pl.name); }).join(", ");
      big = iLost ? "😵" : "🎉";
      title = fo ? esc(loser) + " " + REASON[last.reason] + " — ถือว่ายอมแพ้" : esc(loser) + " ทำกองเกิน " + pub.cap + "!";
      msg = (iLost ? "คุณแพ้ในศึกนี้ ลองใหม่ได้เสมอค่ะ" : "คุณรอด! ผู้แพ้คือ " + esc(loser)) + " · 🏆 ผู้ชนะ: " + winners;
    }
    return '<div class="nnRes"><div class="big">' + big + "</div><h3>" + title + "</h3><p>" + msg + "</p>" + ranks + '<p class="nnD">รวม ' + (pub.turns != null ? pub.turns : pub.turn) + " ตา" +
      (!fo && last.n != null ? " · ไพ่ใบสุดท้าย: " + esc(cn(last.n)) : "") + " · เพดาน " + pub.cap + '</p><p class="nnD">โหมดออนไลน์ยังไม่มีรางวัลเหรียญ</p>' +
      (host ? '<button type="button" class="nnBt" data-act="rematch"' + bd + ">🔁 เล่นอีกครั้ง (Rematch)</button>" : '<p class="nnD">รอ Host กดเล่นอีกครั้ง…</p>') +
      '<button type="button" class="nnBt alt" data-act="leave">🚪 ออกจากห้อง</button>' +
      (host ? '<button type="button" class="nnBt alt" data-act="close">ปิดห้อง</button>' : "") + "</div>";
  }
  function showResult() {
    var g = X.S.game; if (!g || M.resultShown || M.busy || M.queue.length) return;
    var pub = g.public_state; if (pub.over < 0) return;
    M.resultShown = true; clearInterval(M.tick); M.tick = null;
    try { ui().setFs(false); } catch (e) {}
    var body = Q("#onlGBody"); if (body) body.innerHTML = resultHTML(pub);
    var foot = Q("#onlGFoot"); if (foot) foot.innerHTML = "";
    ui().nsfx(pub.over === M.myP ? "boom" : "win");
  }

  /* ---------- นาฬิกา: นับถอยหลังด้วยเวลาเซิร์ฟเวอร์ + เรียก check เมื่อหมดเวลา ---------- */
  function tick() {
    var g = X.S.game;
    if (!g || !Q("#nnT")) { clearInterval(M.tick); M.tick = null; return; }
    var pub = g.public_state; if (pub.over >= 0) return;
    if (!M.busy) paintSay(pub);
    var rem = Date.parse(g.turn_deadline_at) - (Date.now() + X.skew());
    if (isFinite(rem) && rem < -1500 && !M.busy && Date.now() - M.lastCheck > 8000 && X.S.net) {
      M.lastCheck = Date.now();
      setTimeout(function () {
        X.callApi({ action: "check", game_id: g.id }).then(function () { return X.refetch(); }).catch(function () {});
      }, Math.random() * 1500);                // กระจายเวลาเรียก ไม่ให้ทุกเครื่องยิงพร้อมกัน (เซิร์ฟเวอร์กันซ้ำอยู่แล้ว)
    }
  }

  /* ---------- วาด/อัปเดต (เรียกจาก online.js render) ---------- */
  function mount(root, g, pub, me) {
    var u = ui();
    M.mode = pub.mode || "one_loser";
    M.gid = g.id; M.n = pub.players.length; M.cap = pub.cap; M.two = pub.two; M.resultShown = false;
    M.myP = -1; pub.players.forEach(function (pl) { if (pl.seat === me.seat) M.myP = pl.p; });
    M.order = []; for (var i = 0; i < M.n; i++) M.order.push((M.myP + i) % M.n);
    M.names = pub.players.map(function (pl) { return pl.name; });
    M.avatars = pub.players.map(function (pl) { return pickAv(pl); });
    M.pile = (pub.log || []).filter(function (l) { return !l.forfeit && l.n != null; }).slice(-3).map(function (l) { return { n: l.n, r: rnd(20), x: rnd(6) }; });
    M.shownSeq = pub.last ? pub.last.seq : -1; M.queue = []; M.queued = {}; M.busy = false; M.sel = null; M.capSeq = -2; M.sending = false;
    root.innerHTML = wrap('<div id="onlGBan"></div><div id="onlGBody">' + (pub.over >= 0 ? resultHTML(pub) : tableHTML()) + '</div><div id="onlGFoot"></div>');
    if (pub.over >= 0) { M.resultShown = true; return; }
    M.fs = M.n >= 3;
    if (M.fs) u.setFs(true);
    clearInterval(M.tick); M.tick = setInterval(tick, 1000);
    paintAll(pub);
    if (pub.last) setCap(pub.last);
    Q("#onlGFoot").innerHTML = '<button type="button" class="onlX lv" data-act="leave">ออกจากห้อง (ถือว่ายอมแพ้)</button>';
  }

  function render(root) {
    var S = X.S, g = S.game, me = X.mine(), u = ui();
    if (!u || !window.NNEngine) { root.innerHTML = wrap(X.top("🎮 เกมเลขเพดาน") + "<p>โหลดชุดแสดงผลเกมไม่สำเร็จ ลองรีเฟรชหน้าเว็บ</p>"); return true; }
    if (!g || !me || !S.hand) { M.gid = null; root.innerHTML = wrap(X.top("🎮 เกมเลขเพดาน") + SPIN); return true; }
    if (!M.ready) { ensureThumbs(); M.gid = null; root.innerHTML = wrap(X.top("🎮 เกมเลขเพดาน") + SPIN + '<p class="onlHint">กำลังโหลดไพ่…</p>'); return true; }
    var pub = g.public_state;
    if (M.gid !== g.id || !(root.querySelector("#nnT") || root.querySelector(".nnRes"))) mount(root, g, pub, me);
    var ban = root.querySelector("#onlGBan"); if (ban) ban.innerHTML = X.banner();
    if (pub.last && pub.last.seq > M.shownSeq) {          // เข้าคิวแอนิเมชันสำหรับ action ที่ยังไม่เคยแสดง
      (pub.log && pub.log.length ? pub.log : [pub.last]).forEach(function (l) {
        if (l.seq > M.shownSeq && !M.queued[l.seq]) { M.queued[l.seq] = 1; M.queue.push(l); }
      });
    }
    if (root.querySelector("#nnT")) pump();
    else if (root.querySelector(".nnRes")) { var b = root.querySelector("#onlGBody"); if (b && pub.over >= 0) b.innerHTML = resultHTML(pub); }
    return true;
  }

  /* ---------- การกระทำ ---------- */
  function playSel() {
    var S = X.S, g = S.game; if (!g || M.sel == null || M.busy || M.sending) return;
    var pub = g.public_state; if (!myTurn(pub)) return;
    var el = Q("#nnHand .nnC.on"), id = M.sel, req = X.uuid();
    M.rc = el ? ui().rectOf(el) : null; M.sending = true; M.sel = null; paintHand();
    X.run(async function () {
      try {
        var res = null, tries = 0;
        while (true) {                 // เน็ตหลุดกลางทาง: ส่งซ้ำด้วย request_id เดิมได้ปลอดภัย (เซิร์ฟเวอร์กันซ้ำ)
          try { res = await X.callApi({ action: "play", game_id: g.id, card_id: id, request_id: req, expected_version: g.version }); break; }
          catch (e) { if (++tries > 2) throw e; await new Promise(function (r) { setTimeout(r, 700 * tries); }); }
        }
        if (res.error === "stale") { await X.refetch(); throw new Error("stale"); }
        if (res.error) throw new Error(res.error);
        await X.refetch();
      } catch (e) { M.rc = null; throw e; }
      finally { M.sending = false; paintHand(); }
    });
  }

  function onClick(a, v) {
    var u = ui();
    if (a === "ncard") { var id = +v; M.sel = (M.sel === id ? null : id); paintHand(); return true; }
    if (a === "nopt") { playSel(); return true; }
    if (a === "nrules") { var r = Q("#nnRules"), g = X.S.game; if (r && g) { r.innerHTML = rulesHTML(g.public_state); r.hidden = false; } return true; }
    if (a === "nrulesx") { var r2 = Q("#nnRules"); if (r2) r2.hidden = true; return true; }
    if (a === "nspd") { var ks = ["slow", "norm", "fast"]; u.PF.spd = ks[(ks.indexOf(u.PF.spd) + 1) % 3]; u.save(); var b = Q("#nnSpd"); if (b) b.textContent = u.SPL[u.PF.spd]; return true; }
    if (a === "nfs") { var t = Q("#nnT"); M.fs = !(t && t.classList.contains("fs")); u.setFs(M.fs); return true; }
    if (a === "nhide") { X.hide(); return true; }
    if (a === "rematch") { X.run(async function () { await X.rpc("nn_rematch", { p_room: X.S.rid }); await X.refetch(); }); return true; }
    return false;
  }

  function onHide() { try { var u = ui(); if (u && Q("#nnT")) u.setFs(false); } catch (e) {} }
  function onShow() { try { var u = ui(); if (u && M.fs && Q("#nnT")) u.setFs(true); } catch (e) {} }
  function reset() { if (!M.gid && !M.tick) return; clearInterval(M.tick); M.tick = null; M.gid = null; M.queue = []; M.queued = {}; M.busy = false; M.sending = false; try { var u = ui(); if (u) u.setFs(false); } catch (e) {} }

  window.NNOnlineGame = { init: function (x) { X = x; }, render: render, onClick: onClick, onHide: onHide, onShow: onShow, reset: reset };
})();
