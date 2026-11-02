/* HRTA Online Multiplayer - Phase 2: หน้าจอเล่นเกม (โต๊ะ + มือไพ่ + ผลลัพธ์ + Rematch)
 * client แสดงผลอย่างเดียว: ทุกอย่างที่เป็นกติกา/สุ่ม/จั่ว/ตัดสิน ทำที่ Edge Function `nn-api`
 * online.js ส่งตัวช่วยเข้ามาทาง NNOnlineGame.init(X)
 */
(function () {
  "use strict";
  var X = null;
  var TH = {}, THq = {};

  function cards() { try { return window.fzCards ? window.fzCards() : []; } catch (e) { return []; } }
  function cardName(n) { var c = cards()[n]; return c ? c.n : "ไพ่ " + n; }

  /* ภาพไพ่ย่อ (ภาพเต็มของแอปใหญ่ ~400 KB/ใบ จึงย่อด้วย canvas ครั้งเดียวแล้วเก็บไว้) */
  function thumb(n) {
    if (TH[n]) return TH[n] === "x" ? "" : TH[n];
    if (!THq[n]) {
      THq[n] = 1;
      var c = cards()[n];
      if (!c || !c.img) { TH[n] = "x"; return ""; }
      var im = new Image();
      im.onload = function () {
        try {
          var w = 150, h = Math.round(im.naturalHeight * w / im.naturalWidth), cv = document.createElement("canvas");
          cv.width = w; cv.height = h; cv.getContext("2d").drawImage(im, 0, 0, w, h);
          TH[n] = cv.toDataURL("image/jpeg", 0.8);
        } catch (e) { TH[n] = c.img; }
        X.softRender();
      };
      im.onerror = function () { TH[n] = "x"; X.softRender(); };
      im.src = c.img;
    }
    return "";
  }

  function pubOpts(pub, n) {            // ข้อความผลของไพ่ตามสถานะปัจจุบัน (ใช้ engine ตัวเดียวกับเซิร์ฟเวอร์)
    var G = window.NNEngine.engine({ cap: pub.cap, n: pub.n });
    G.total = pub.total; G.prev = pub.prev;
    return G.opts(n)[0];
  }
  function preview(pub, n, myP) {       // ผลลัพธ์คร่าว ๆ ของกอง + เตือนถ้าเสี่ยงเกิน
    var o = pubOpts(pub, n), heat = pub.heat || 0, t;
    if (o.fx === "wheel") {
      var lo = Math.max(0, pub.total - 15) + heat, hi = pub.total + 25 + heat;
      return { text: "สุ่ม → " + lo + "…" + hi, bust: lo > pub.cap, risk: hi > pub.cap, opt: o };
    }
    t = (o.set != null ? o.set : Math.max(0, pub.total + o.v)) + heat;
    var shield = pub.shield[myP];
    return { text: "→ " + t + (heat ? " (รวมไฟลาม +" + heat + ")" : ""), bust: t > pub.cap && !shield, risk: false, opt: o, saved: t > pub.cap && shield };
  }

  function seatChip(pub, pl, myP) {
    var p = pl.p, S = X.S, turn = pub.cur === p && pub.over < 0, lost = pub.over === p;
    var rp = S.players.filter(function (x) { return x.seat === pl.seat; })[0];
    var on = rp ? (S.link === "bad" ? null : (rp.user_id === S.uid ? (S.link === "ok") : (S.link === "ok" && Object.keys(S.online).length ? !!S.online[rp.user_id] : null))) : null;
    var tags = "";
    if (pub.shield[p]) tags += '<i title="มีโล่">🛡️</i>';
    if (pub.force === p) tags += '<i title="ถูกบังคับลงใบสูงสุด">⛓️</i>';
    if (pub.dbl && pub.dbl.p === p) tags += '<i title="ต้องลง 2 ใบติด">✌️</i>';
    return '<div class="onlGP' + (turn ? " turn" : "") + (lost ? " lost" : "") + (p === myP ? " me" : "") + '">' +
      '<span class="onlDot ' + (on === null ? "" : on ? "on" : "off") + '"></span>' +
      '<div class="onlAv sm">' + X.avImg(pl.avatar) + "</div>" +
      '<div class="onlNm"><b>' + X.esc(pl.name) + "</b>" + (p === myP ? " (คุณ)" : "") + "</div>" +
      '<div class="onlSt">🂠 × ' + pub.handCounts[p] + " " + tags + "</div>" +
      (turn ? '<div class="onlTurn">ถึงตา' + (p === myP ? "คุณ" : "") + "</div>" : "") + "</div>";
  }

  function lastLine(pub) {
    var l = pub.last; if (!l) return "เกมเริ่มแล้ว — กองกลางเริ่มที่ 0";
    var pl = pub.players[l.p];
    var s = X.esc(pl ? pl.name : "?") + " ลง <b>" + X.esc(cardName(l.n)) + "</b> · " + X.esc(l.t) + " → <b>" + l.after + "</b>";
    if (l.saved) s += " 🛡️ โล่แตก!";
    if (l.bust) s += " 💥";
    return s;
  }

  function handHTML(pub, myP, canAct) {
    var S = X.S, h = S.hand;
    if (!h) return '<div class="onlSpin" role="progressbar" aria-label="กำลังโหลดมือ"></div>';
    var mx = -1; h.forEach(function (c) { if (c.n > mx) mx = c.n; });
    var forced = pub.force === myP;
    return '<div class="onlHand">' + h.map(function (c) {
      var lock = forced && c.n !== mx, img = thumb(c.n);
      return '<button type="button" class="onlCard' + (S.sel === c.id ? " sel" : "") + (lock ? " lock" : "") + '" data-act="pick" data-v="' + c.id + '"' +
        (lock || pub.over >= 0 ? " disabled" : "") + ' aria-label="' + X.esc(cardName(c.n)) + ' เลข ' + c.n + '">' +
        (img ? '<img alt="" src="' + img + '">' : '<span class="onlPh">🂠</span>') +
        '<span class="onlCn">' + c.n + '</span><span class="onlCt">' + X.esc(cardName(c.n)) + (lock ? " 🔒" : "") + "</span></button>";
    }).join("") + "</div>";
  }

  function resultHTML(pub, isHost) {
    var loser = pub.players[pub.over], winners = pub.players.filter(function (pl) { return pl.p !== pub.over; });
    var l = pub.last;
    return '<div class="onlRes"><h3>💥 ' + X.esc(loser.name) + " ทำกองเกินเพดาน!</h3>" +
      '<p class="onlSub">ลง ' + X.esc(l ? cardName(l.n) : "") + " ทำให้กองเป็น " + (l ? l.after : "?") + " (เพดาน " + pub.cap + ")</p>" +
      '<div class="lb">🏆 ผู้ชนะ</div><div class="onlWin">' + winners.map(function (pl) {
        return '<div class="onlGP"><div class="onlAv sm">' + X.avImg(pl.avatar) + '</div><div class="onlNm"><b>' + X.esc(pl.name) + "</b></div></div>";
      }).join("") + "</div>" +
      '<div class="lb">สถิติเกม</div><div class="onlInfo"><span>🔁 ' + pub.turn + " ตา</span><span>🎯 เพดาน " + pub.cap + "</span><span>🔥 ไฟลามเริ่มตาที่ " + pub.heatAt + "</span></div>" +
      '<p class="onlHint">โหมดออนไลน์ยังไม่มีรางวัลเหรียญ</p>' +
      (isHost ? '<button type="button" class="onlBtn pri" data-act="rematch"' + (X.S.busy ? " disabled" : "") + ">🔄 เล่นอีกครั้ง (Rematch)</button>"
        : '<p class="onlHint">รอ Host กดเล่นอีกครั้ง</p>') +
      '<button type="button" class="onlBtn warn" data-act="leave">ออกจากห้อง</button>' +
      (isHost ? '<button type="button" class="onlBtn warn" data-act="close">ปิดห้อง</button>' : "") + "</div>";
  }

  function view() {
    var S = X.S, g = S.game, me = X.mine();
    if (!g || !me) return X.top("🎮 เกมเลขเพดาน") + '<div class="onlSpin" role="progressbar" aria-label="กำลังโหลดเกม"></div>';
    var pub = g.public_state, myP = -1;
    pub.players.forEach(function (pl) { if (pl.seat === me.seat) myP = pl.p; });
    var over = pub.over >= 0, myTurn = !over && pub.cur === myP;
    var pc = pub.cap ? pub.total / pub.cap : 0, tone = pc < 0.5 ? "ok" : pc < 0.8 ? "warn" : "hot";
    var sel = null;
    (S.hand || []).forEach(function (c) { if (c.id === S.sel) sel = c; });
    var bar = "", act = "";
    if (!over && sel) {
      var pv = preview(pub, sel.n, myP);
      act = '<div class="onlAct"><b>' + X.esc(cardName(sel.n)) + " (" + sel.n + ")</b> · " + X.esc(pv.opt.t) + ' <span class="' + (pv.bust ? "bad" : pv.risk ? "warnTxt" : "") + '">' + X.esc(pv.text) +
        (pv.bust ? " ⚠️ เกินเพดานแพ้!" : pv.saved ? " 🛡️ (โล่ช่วยไว้)" : pv.risk ? " ⚠️ เสี่ยงเกิน" : "") + "</span></div>" +
        '<button type="button" class="onlBtn pri" data-act="playcard"' + (myTurn && !S.busy ? "" : " disabled") + ">▶ ลงไพ่ใบนี้</button>";
    }
    var hint = over ? "" : myTurn ? (pub.force === myP ? "ถึงตาคุณ — ถูกบังคับ ต้องลงใบสูงสุด" : pub.dbl && pub.dbl.p === myP ? "ถึงตาคุณ — ต้องลง 2 ใบติด (เหลืออีก " + pub.dbl.left + ")" : "ถึงตาคุณ — เลือกไพ่แล้วกดลง")
      : "รอ " + X.esc(pub.players[pub.cur].name) + " ลงไพ่…";
    return X.banner() + X.top("🎮 รอบที่ " + g.round_no + " · ตาที่ " + (pub.turn + 1)) +
      '<div class="onlTbl ' + tone + '"><div class="onlBig" aria-live="polite"><b class="' + (S.flash ? "flash" : "") + '">' + pub.total + "</b><span>/ " + pub.cap + "</span></div>" +
      '<div class="onlBar"><i style="width:' + Math.min(100, Math.round(pc * 100)) + '%"></i></div>' +
      '<div class="onlInfo"><span>' + (pub.dir === 1 ? "↻ ตามเข็ม" : "↺ ทวนเข็ม") + "</span>" +
      (pub.heat ? "<span>🔥 ไฟลาม +" + pub.heat + "/ตา</span>" : "<span>🔥 เริ่มตาที่ " + pub.heatAt + "</span>") + "</div>" +
      '<p class="onlLast">' + lastLine(pub) + "</p></div>" +
      '<div class="onlGPs">' + pub.players.map(function (pl) { return seatChip(pub, pl, myP); }).join("") + "</div>" +
      (over ? resultHTML(pub, X.isHost()) :
        '<p class="onlHint ' + (myTurn ? "mine" : "") + '">' + hint + "</p>" + handHTML(pub, myP, myTurn) + act) +
      (over ? "" : '<button type="button" class="onlX lv" data-act="leave">ออกจากห้อง</button>') +
      (pub.log && pub.log.length > 1 ? '<details class="onlLog"><summary>ประวัติตาล่าสุด</summary>' + pub.log.slice().reverse().map(function (l) {
        var pl = pub.players[l.p]; return "<div>" + X.esc(pl ? pl.name : "?") + ": " + X.esc(cardName(l.n)) + " · " + X.esc(l.t) + " → " + l.after + "</div>";
      }).join("") + "</details>" : "");
  }

  async function playCard() {
    var S = X.S, g = S.game;
    if (!g || S.sel == null) return;
    var req = X.uuid(), id = S.sel;
    return X.run(async function () {
      var res = null, tries = 0;
      while (true) {                          // เน็ตหลุดกลางทาง: ส่งซ้ำด้วย request_id เดิมได้ปลอดภัย (เซิร์ฟเวอร์กันซ้ำ)
        try { res = await X.callApi({ action: "play", game_id: g.id, card_id: id, request_id: req, expected_version: g.version }); break; }
        catch (e) { if (++tries > 2) throw e; await new Promise(function (r) { setTimeout(r, 700 * tries); }); }
      }
      if (res.error === "stale") { await X.refetch(); throw new Error("stale"); }
      if (res.error) throw new Error(res.error);
      S.sel = null;
      await X.refetch();
    });
  }

  function onClick(a, v) {
    var S = X.S;
    if (a === "pick") { S.sel = (S.sel === +v ? null : +v); X.render(); return true; }
    if (a === "playcard") { playCard(); return true; }
    if (a === "rematch") { X.run(async function () { await X.rpc("nn_rematch", { p_room: S.rid }); await X.refetch(); }); return true; }
    return false;
  }

  window.NNOnlineGame = { init: function (x) { X = x; }, view: view, onClick: onClick };
})();
