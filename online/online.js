/* HRTA Online Multiplayer - Phase 1: ห้อง + ล็อบบี้
 * ไฟล์นี้ทำงานแยกจากเกมเดิม: เพิ่มปุ่ม "เล่นออนไลน์" ในหน้าตั้งค่าเกมเลขเพดาน และเปิดหน้าจอเต็ม (#onl)
 * ไม่ได้แก้ engine/AI/โหมดเพื่อนเดิม  การเขียนข้อมูลทั้งหมดไปที่ Supabase ผ่านฟังก์ชัน nn_* เท่านั้น (ดู supabase/migrations)
 */
(function () {
  "use strict";
  var CFG = window.HRTA_ONLINE || {};
  var S = {
    sb: null, uid: null, rid: null, room: null, players: [], online: {}, ch: null,
    link: "idle", busy: false, screen: "menu", net: navigator.onLine !== false,
    name: "", av: "", cap: 150, mode: "one_loser", code: "", timer: null, root: null,
    game: null, hand: null, pending: null, sel: null, flash: false, skewMs: 0
  };

  var ERR = {
    not_authenticated: "ยังไม่ได้เข้าสู่ระบบ ลองใหม่อีกครั้ง",
    bad_name: "กรุณาใส่ชื่อผู้เล่น (ไม่เกิน 12 ตัวอักษร)",
    bad_cap: "ค่าเพดานไม่ถูกต้อง", bad_mode: "โหมดเกมไม่ถูกต้อง",
    already_in_room: "คุณอยู่ในอีกห้องหนึ่งอยู่แล้ว",
    rate_limited: "ลองบ่อยเกินไป รอสักครู่แล้วลองใหม่",
    room_not_found: "ไม่พบห้องนี้ ตรวจรหัสอีกครั้ง",
    room_expired: "ห้องนี้หมดอายุหรือถูกปิดแล้ว",
    room_started: "ห้องนี้เริ่มเล่นแล้ว เข้าไม่ได้",
    room_full: "ห้องเต็มแล้ว (4 คน)",
    room_closed: "ห้องนี้ปิดแล้ว",
    name_taken: "ชื่อนี้มีคนใช้ในห้องแล้ว เปลี่ยนชื่อก่อนนะ",
    avatar_taken: "รูปนี้มีคนเลือกในห้องแล้ว เลือกรูปอื่นนะ",
    not_in_room: "คุณไม่ได้อยู่ในห้องนี้",
    not_host: "เฉพาะ Host เท่านั้น",
    bad_player_count: "ต้องมีผู้เล่น 2–4 คน",
    not_all_ready: "ยังมีคนที่ไม่ได้กด พร้อม",
    code_generation_failed: "สร้างรหัสห้องไม่สำเร็จ ลองอีกครั้ง",
    mode_not_ready: "โหมดนี้ยังเริ่มเล่นไม่ได้",
    eliminated: "คุณตกรอบแล้ว",
    bad_mode: "โหมดเกมไม่ถูกต้อง",
    not_your_turn: "ยังไม่ถึงตาคุณ",
    card_not_in_hand: "ไม่มีไพ่ใบนี้ในมือ",
    illegal_card: "ลงใบนี้ไม่ได้ (ถูกบังคับให้ลงใบสูงสุด)",
    game_over: "เกมจบแล้ว",
    game_not_found: "ไม่พบเกม ลองรีเฟรช",
    stale: "สถานะเกมเปลี่ยนไปแล้ว ลองอีกครั้ง",
    not_in_game: "คุณไม่ได้อยู่ในเกมนี้",
    room_not_finished: "เกมยังไม่จบ",
    server_error: "เซิร์ฟเวอร์ขัดข้อง ลองใหม่อีกครั้ง",
    bad_request: "คำขอไม่ถูกต้อง",
    choice_required: "ต้องเลือกตัวเลือกของไพ่ก่อน",
    bad_choice: "ตัวเลือกไม่ถูกต้อง ลองใหม่อีกครั้ง",
    choice_pending: "กรุณาจัดการตัวเลือกไพ่ที่ค้างอยู่ก่อน",
    no_pending_choice: "ไม่มีตัวเลือกที่รออยู่",
    interrupt_closed: "หมดช่วงเวลาแทรกเทิร์นแล้ว",
    interrupt_unavailable: "ตอนนี้ยังแทรกเทิร์นไม่ได้",
    not_empress: "ต้องใช้ Empress และต้องไม่ขัดกับการบังคับไพ่"
  };
  var MODE_TXT = {
    one_loser: "แพ้ 1 คน (ที่เหลือชนะ)",
    elimination: "คัดออกทีละคน เหลือผู้ชนะ 1 คน"
  };

  /* ---------- ตัวช่วย ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function ls(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {}
    return null;
  }
  function photos() { try { return typeof PHOTOS !== "undefined" ? PHOTOS : {}; } catch (e) { return {}; } }
  function avImg(key) {
    var p = photos()[key];
    return p ? '<img alt="" src="' + esc(p) + '">' : "🧑";
  }
  function toast(t) {
    var e = $("#onlToast");
    if (!e) { e = document.createElement("div"); e.id = "onlToast"; e.setAttribute("role", "status"); document.body.appendChild(e); }
    e.textContent = t; e.classList.add("on");
    clearTimeout(toast.t); toast.t = setTimeout(function () { e.classList.remove("on"); }, 2600);
  }
  function errText(e) {
    var m = (e && e.message) || String(e || "");
    if (ERR[m]) return ERR[m];
    if (m === "lib_missing") return "โหลดตัวเชื่อมต่อออนไลน์ไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วรีเฟรชหน้าเว็บ";
    if (/anonymous/i.test(m)) return "ผู้ดูแลยังไม่ได้เปิด Anonymous sign-ins ใน Supabase";
    if (/failed to fetch|networkerror|load failed/i.test(m)) return "เชื่อมต่ออินเทอร์เน็ตไม่ได้";
    return "เกิดข้อผิดพลาด: " + m;
  }

  /* ---------- Supabase ---------- */
  var libP = null;
  function loadLib() {            // โหลดไลบรารี Supabase เฉพาะตอนเปิดโหมดออนไลน์ (ไม่กระทบคนที่ไม่ได้ใช้)
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    if (libP) return libP;
    libP = new Promise(function (ok, bad) {
      var sc = document.createElement("script");
      sc.src = CFG.lib; sc.async = true;
      sc.onload = function () { ok(); };
      sc.onerror = function () { libP = null; bad(new Error("lib_missing")); };
      document.head.appendChild(sc);
    });
    return libP;
  }
  function client() {
    if (S.sb) return S.sb;
    if (!window.supabase || !window.supabase.createClient) throw new Error("lib_missing");
    S.sb = window.supabase.createClient(CFG.url, CFG.key, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: "hrta-onl-auth" }
    });
    return S.sb;
  }
  async function ensureAuth() {
    await loadLib();
    var sb = client();
    var r = await sb.auth.getSession();
    var ses = r.data && r.data.session;
    if (!ses) {
      var a = await sb.auth.signInAnonymously();
      if (a.error) throw a.error;
      ses = a.data.session;
    }
    S.uid = ses.user.id;
    try { sb.realtime.setAuth(ses.access_token); } catch (e) {}
    return S.uid;
  }
  async function rpc(fn, args) {
    var r = await client().rpc(fn, args || {});
    if (r.error) throw r.error;
    return r.data;
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16); crypto.getRandomValues(b); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
    return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
  }
  // เรียก Edge Function (เริ่มเกม/ลงไพ่) — ตัดสินทุกอย่างที่เซิร์ฟเวอร์ ; คืน {ok..} หรือ {error:"code"}
  async function callApi(body) {
    await ensureAuth();
    var ses = (await client().auth.getSession()).data.session;
    var r = await fetch(CFG.url + "/functions/v1/nn-api", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + ses.access_token, apikey: CFG.key },
      body: JSON.stringify(body)
    });
    var j;
    try { j = await r.json(); } catch (e) { throw new Error("server_error"); }
    return j;
  }
  var raf = 0;
  function softRender() { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; render(); }); }
  function setGame(g) {
    var prev = S.game; S.game = g;
    if (prev && prev.id === g.id && g.version > prev.version) {
      S.flash = true; setTimeout(function () { S.flash = false; render(); }, 700);
    }
    if (S.sel != null && S.hand && !S.hand.some(function (c) { return c.id === S.sel; })) S.sel = null;
  }

  /* ---------- ห้อง: โหลดสถานะ + Realtime ---------- */
  function schedule() {
    clearTimeout(S.timer);
    S.timer = setTimeout(refetch, 150);
  }
  async function refetch() {
    if (!S.rid) return;
    try {
      var sb = client();
      var a = await sb.from("rooms").select("*").eq("id", S.rid).maybeSingle();
      var b = await sb.from("room_players").select("*").eq("room_id", S.rid).is("left_at", null).order("seat");
      if (a.error || b.error) throw (a.error || b.error);
      var me = (b.data || []).filter(function (p) { return p.user_id === S.uid; })[0];
      if (!a.data || !me) { exitRoom("คุณไม่ได้อยู่ในห้องนี้แล้ว"); return; }
      var prevHost = S.room ? S.room.host_user_id : null;
      S.room = a.data; S.players = b.data || [];
      if (prevHost && prevHost !== S.room.host_user_id) {
        var nh = S.players.filter(function (p) { return p.user_id === S.room.host_user_id; })[0];
        toast((S.room.host_user_id === S.uid ? "คุณ" : (nh ? nh.player_name : "ผู้เล่นอื่น")) + " เป็น Host คนใหม่");
      }
      if (S.room.status === "playing" || S.room.status === "finished") {
        var gq = await sb.from("games").select("*").eq("room_id", S.rid).order("round_no", { ascending: false }).limit(1).maybeSingle();
        if (gq.error) throw gq.error;
        var g = gq.data;
        if (g) {
          if (!S.game || g.id !== S.game.id || g.version >= S.game.version) setGame(g);
          var hq = await sb.from("player_private_states").select("hand,pending").eq("game_id", g.id).eq("user_id", S.uid).maybeSingle();
          if (!hq.error && hq.data) { S.hand = hq.data.hand; S.pending = hq.data.pending || null; }
          if (S.sel != null && S.hand && !S.hand.some(function (c) { return c.id === S.sel; })) S.sel = null;
        }
      } else { S.game = null; S.hand = null; S.pending = null; S.sel = null; }
      render();
    } catch (e) {
      S.link = "bad"; render();
    }
  }
  function subscribe() {
    unsub();
    var sb = client(), ch = sb.channel("onl:" + S.rid, { config: { presence: { key: S.uid } } });
    ch.on("postgres_changes", { event: "*", schema: "public", table: "games", filter: "room_id=eq." + S.rid }, function (pl) {
        var g = pl && pl.new;
        if (g && g.id && (!S.game || g.id !== S.game.id || g.version >= S.game.version)) { setGame(g); render(); }
        schedule();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "player_private_states", filter: "user_id=eq." + S.uid }, function (pl) {
        var r = pl && pl.new;
        if (r && r.hand && S.game && r.game_id === S.game.id) {
          S.hand = r.hand; S.pending = r.pending || null;
          if (S.sel != null && !S.hand.some(function (c) { return c.id === S.sel; })) S.sel = null;
          render();
        } else schedule();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "room_players", filter: "room_id=eq." + S.rid }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: "id=eq." + S.rid }, schedule)
      .on("presence", { event: "sync" }, function () {
        var st = ch.presenceState(), o = {};
        Object.keys(st).forEach(function (k) { o[k] = true; });
        S.online = o; render();
      })
      .subscribe(function (status) {
        if (status === "SUBSCRIBED") { S.link = "ok"; resubN = 0; try { ch.track({ t: Date.now() }); } catch (e) {} schedule(); }
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") { S.link = "bad"; render(); scheduleResub(); }
      });
    S.ch = ch;
  }
  function unsub() {
    if (S.ch) { try { client().removeChannel(S.ch); } catch (e) {} S.ch = null; }
    S.online = {}; S.link = "idle";
  }
  /* ---------- heartbeat (ให้เซิร์ฟเวอร์รู้ว่ายังออนไลน์ + ซิงก์นาฬิกา) และ resubscribe แบบถอยหลัง ---------- */
  var hbT = null, resubT = null, resubN = 0;
  async function beat() {
    if (!S.rid || !S.net) return;
    try {
      var d = await rpc("nn_heartbeat", { p_room: S.rid });
      if (d && d.now_ms) S.skewMs = d.now_ms - Date.now();
    } catch (e) { /* ยังไม่ได้รัน SQL 003 หรือไม่ได้อยู่ในห้องแล้ว: ข้ามได้ */ }
  }
  function startBeat() { stopBeat(); beat(); hbT = setInterval(beat, 20000); }
  function stopBeat() { clearInterval(hbT); hbT = null; clearTimeout(resubT); resubT = null; resubN = 0; }
  function scheduleResub() {
    if (resubT || !S.rid) return;
    var d = Math.min(15000, 2000 * Math.pow(2, resubN++));
    resubT = setTimeout(function () { resubT = null; if (S.rid && S.link === "bad") { subscribe(); schedule(); } }, d);
  }
  function enterRoom(id) {
    S.rid = id; S.room = null; S.players = []; S.game = null; S.hand = null; S.pending = null; S.sel = null; S.screen = "lobby";
    subscribe(); startBeat(); refetch(); render();
  }
  function exitRoom(msg) {
    unsub(); stopBeat(); clearTimeout(S.timer);
    if (window.NNOnlineGame) NNOnlineGame.reset();
    if (S.root && !S.root.hidden) document.documentElement.style.overflow = "hidden";
    S.rid = null; S.room = null; S.players = []; S.screen = "menu"; S.game = null; S.hand = null; S.pending = null; S.sel = null;
    if (msg) toast(msg);
    syncEntry(); render();
  }

  /* ---------- การกระทำ ---------- */
  async function run(fn) {
    if (S.busy) return;
    S.busy = true; render();
    try { await fn(); }
    catch (e) { toast(errText(e)); }
    finally { S.busy = false; render(); }
  }
  function readForm() {
    var n = $("#onlName"); if (n) S.name = n.value;
    var c = $("#onlCode"); if (c) S.code = c.value;
    ls("hrta-onl-name", S.name.trim());
    if (S.av) ls("hrta-onl-av", S.av);
  }
  function doCreate() {
    readForm();
    if (!S.name.trim()) return toast(ERR.bad_name);
    return run(async function () {
      await ensureAuth();
      try {
        var d = await rpc("nn_create_room", { p_name: S.name, p_avatar: S.av, p_cap: S.cap, p_mode: S.mode });
        enterRoom(d.room_id);
      } catch (e) {
        if (e && e.message === "already_in_room") { await resume(true); return; }
        throw e;
      }
    });
  }
  function doJoin() {
    readForm();
    if (!S.name.trim()) return toast(ERR.bad_name);
    if (!/^[A-Za-z0-9]{6}$/.test(S.code.trim())) return toast("รหัสห้องต้องมี 6 ตัว");
    return run(async function () {
      await ensureAuth();
      var d = await rpc("nn_join_room", { p_code: S.code, p_name: S.name, p_avatar: S.av });
      if (d && d.error) {
        if (d.error === "already_in_room") { await resume(true); return; }
        throw new Error(d.error);
      }
      enterRoom(d.room_id);
    });
  }
  async function resume(announce) {
    var d = await rpc("nn_my_room");
    if (d && d.room_id) { if (announce) toast("กลับเข้าห้อง " + d.code + " ที่คุณอยู่"); enterRoom(d.room_id); return true; }
    return false;
  }
  function amAlive() {                       // ยังอยู่ในเกมอยู่ไหม (โหมดคัดออก: ตกรอบแล้วไม่ต้องยอมแพ้ตอนออก)
    var g = S.game, me = null;
    S.players.forEach(function (p) { if (p.user_id === S.uid) me = p; });
    if (!g || !me) return false;
    var pub = g.public_state, alive = true;
    pub.players.forEach(function (pl) { if (pl.seat === me.seat && pub.alive && pub.alive.indexOf(pl.p) < 0) alive = false; });
    return alive;
  }
  function mine() {
    return S.players.filter(function (p) { return p.user_id === S.uid; })[0];
  }

  /* ---------- หน้าจอ ---------- */
  function seg(a, vals, cur, off) {
    return '<div class="onlSeg">' + vals.map(function (v) {
      return '<button type="button" data-act="' + a + '" data-v="' + v[0] + '" class="' + (String(cur) === String(v[0]) ? "on" : "") + '"' + (off || v[2] ? " disabled" : "") + ">" + v[1] + "</button>";
    }).join("") + "</div>";
  }
  function avGrid() {
    var ks = Object.keys(photos());
    if (!ks.length) return '<p class="onlSub">ยังไม่มีรูปทีมในแอป จะใช้ไอคอนแทน</p>';
    return '<div class="onlAvG" id="onlAvG">' + ks.map(function (k) {
      return '<button type="button" data-act="av" data-v="' + esc(k) + '" class="' + (S.av === k ? "on" : "") + '" aria-label="รูป ' + esc(k) + '">' + avImg(k) + "<span>" + esc(k) + "</span></button>";
    }).join("") + "</div>";
  }
  function formTop(withAv) {
    return '<div class="lb">ชื่อผู้เล่น</div><input class="onlIn" id="onlName" maxlength="12" autocomplete="off" value="' + esc(S.name) + '" placeholder="เช่น เบล, เจน, ปีเตอร์">' +
      (withAv ? '<div class="lb">เลือกรูปของคุณ</div>' + avGrid() : "");
  }
  function top(title, backTo) {
    return '<div class="onlTop">' + (backTo ? '<button type="button" class="onlX" data-act="go" data-v="' + backTo + '" aria-label="ย้อนกลับ">‹ กลับ</button>' : "") +
      "<h2>" + title + '</h2><button type="button" class="onlX" data-act="hide" aria-label="ปิดหน้าต่างออนไลน์">✕</button></div>';
  }
  function banner() {
    if (!S.net) return '<div class="onlBan bad">ไม่มีอินเทอร์เน็ต กำลังรอเชื่อมต่อใหม่…</div>';
    if (S.screen === "lobby" && S.link === "bad") return '<div class="onlBan">กำลังเชื่อมต่อห้องใหม่… <button type="button" class="onlX" data-act="reload">ลองเลย</button></div>';
    return "";
  }
  function viewMenu() {
    return top("🌐 เล่นออนไลน์") +
      '<p class="onlSub">เล่นเกมเลขเพดานกับเพื่อน 2–4 คน คนละเครื่อง ผ่านอินเทอร์เน็ต (ไม่มี AI ร่วมเล่น)</p>' +
      '<button type="button" class="onlBtn pri" data-act="go" data-v="create">➕ สร้างห้องใหม่</button>' +
      '<button type="button" class="onlBtn" data-act="go" data-v="join">🔑 เข้าร่วมห้องด้วยรหัส</button>' +
      '<p class="onlHint">ยังไม่มีรางวัลเหรียญในโหมดออนไลน์</p>';
  }
  function viewCreate() {
    return top("➕ สร้างห้อง", "menu") + formTop(true) +
      '<div class="lb">เพดาน (เกินแล้วแพ้)</div>' + seg("cap", [[120, "120 · สบาย"], [150, "150 · กลาง"], [200, "200 · ยาว"]], S.cap) +
      '<div class="lb">โหมดจบเกม</div>' + seg("mode", [["one_loser", "แพ้ 1 คน"], ["elimination", "คัดออก"]], S.mode) +
      '<p class="onlSub" id="onlModeD">' + MODE_TXT[S.mode] + "</p>" +
      '<button type="button" class="onlBtn pri" data-act="create"' + (S.busy ? " disabled" : "") + ">สร้างห้อง</button>";
  }
  function viewJoin() {
    return top("🔑 เข้าร่วมห้อง", "menu") + formTop(true) +
      '<div class="lb">รหัสห้อง 6 ตัว</div><input class="onlIn code" id="onlCode" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" value="' + esc(S.code) + '" placeholder="······">' +
      '<button type="button" class="onlBtn pri" data-act="join"' + (S.busy ? " disabled" : "") + ">เข้าห้อง</button>";
  }
  function seatHTML(p) {
    var me = p.user_id === S.uid;
    var on = S.link === "bad" ? (me ? false : null)
      : me ? (S.link === "ok" ? true : null)
      : (S.link === "ok" && Object.keys(S.online).length ? !!S.online[p.user_id] : null);
    var dot = on === null ? "" : (on ? "on" : "off");
    return '<div class="onlSeat' + (me ? " me" : "") + (p.is_ready ? " ready" : "") + '">' +
      '<span class="onlDot ' + dot + '" title="' + (dot === "off" ? "หลุดการเชื่อมต่อ" : "ออนไลน์") + '"></span>' +
      '<div class="onlAv">' + avImg(p.avatar) + "</div>" +
      '<div class="onlNm"><b>' + esc(p.player_name) + "</b>" + (p.is_host ? " 👑" : "") + (me ? " (คุณ)" : "") + "</div>" +
      '<div class="onlSt">' + (dot === "off" ? "📴 หลุดการเชื่อมต่อ" : (p.is_ready ? "✅ พร้อมแล้ว" : "⏳ ยังไม่พร้อม")) + "</div></div>";
  }
  function viewLobby() {
    var r = S.room, me = mine();
    if (!r || !me) return top("🌐 ห้องออนไลน์") + '<div class="onlSpin" role="progressbar" aria-label="กำลังโหลด"></div>';
    var isHost = r.host_user_id === S.uid, n = S.players.length;
    var allReady = n >= 2 && S.players.every(function (p) { return p.is_ready; });
    var seats = "";
    for (var i = 1; i <= 4; i++) {
      var p = S.players.filter(function (x) { return x.seat === i; })[0];
      seats += p ? seatHTML(p) : '<div class="onlSeat empty">รอผู้เล่น…</div>';
    }
    if (r.status === "closed" || r.status === "expired") {
      return top("🌐 ห้องออนไลน์") + '<p>' + (r.status === "closed" ? "ห้องนี้ถูกปิดแล้ว" : "ห้องนี้หมดอายุแล้ว") + '</p>' +
        '<button type="button" class="onlBtn pri" data-act="leave">กลับเมนู</button>';
    }
    if (r.status === "playing" || r.status === "finished") return top("🎮 เกมเลขเพดาน") + '<div class="onlSpin" role="progressbar" aria-label="กำลังโหลด"></div>';
    var hint = isHost
      ? (n < 2 ? "ต้องมีผู้เล่นอย่างน้อย 2 คนจึงเริ่มได้" : (allReady ? "ทุกคนพร้อมแล้ว เริ่มเกมได้เลย" : "รอทุกคนกด “พร้อม” (รวมคุณด้วย)"))
      : "รอ Host กดเริ่มเกม";
    return banner() + top("🌐 ห้องออนไลน์") +
      '<div class="onlCode"><span class="onlSub">รหัสห้อง</span><b aria-label="รหัสห้อง ' + esc(r.code) + '">' + esc(r.code) + "</b>" +
      '<button type="button" class="onlX" data-act="share">📤 ชวนเพื่อน</button></div>' +
      '<div class="onlInfo"><span>👥 ' + n + "/" + r.max_players + " คน</span><span>🎯 เพดาน " + r.cap + "</span><span>🏁 " + MODE_TXT[r.mode] + "</span></div>" +
      (isHost ? '<div class="lb">ตั้งค่าห้อง (Host)</div>' + seg("scap", [[120, "120"], [150, "150"], [200, "200"]], r.cap, S.busy) +
        seg("smode", [["one_loser", "แพ้ 1 คน"], ["elimination", "คัดออก"]], r.mode, S.busy) +
        '<p class="onlSub">เปลี่ยนตั้งค่า = ทุกคนต้องกด พร้อม ใหม่</p>' : "") +
      '<div class="onlSeats">' + seats + "</div>" +
      '<button type="button" class="onlBtn ' + (me.is_ready ? "" : "pri") + '" data-act="ready"' + (S.busy ? " disabled" : "") + ">" +
      (me.is_ready ? "ยกเลิกพร้อม" : "✅ พร้อม") + "</button>" +
      (isHost ? '<button type="button" class="onlBtn pri" data-act="start"' + (allReady && !S.busy ? "" : " disabled") + ">▶ เริ่มเกม</button>" : "") +
      '<p class="onlHint">' + hint + "</p>" +
      '<button type="button" class="onlBtn warn" data-act="leave">ออกจากห้อง</button>' +
      (isHost ? '<button type="button" class="onlBtn warn" data-act="close">ปิดห้อง</button>' : "");
  }

  function render() {
    if (!S.root || S.root.hidden) return;
    if (S.screen === "lobby" && S.room && (S.room.status === "playing" || S.room.status === "finished") && window.NNOnlineGame) {
      if (NNOnlineGame.render(S.root)) return;       // หน้าเกม: วาดครั้งเดียวแล้วอัปเดตเฉพาะส่วน (ไม่ล้างเอฟเฟกต์กลางแอนิเมชัน)
    }
    if (window.NNOnlineGame && S.screen !== "lobby") NNOnlineGame.reset();
    var scr = S.screen;
    var html = scr === "create" ? viewCreate() : scr === "join" ? viewJoin() : scr === "lobby" ? viewLobby() :
      scr === "loading" ? top("🌐 เล่นออนไลน์") + '<div class="onlSpin" role="progressbar" aria-label="กำลังเชื่อมต่อ"></div>' : viewMenu();
    if (scr !== "lobby") html = banner() + html;
    var keep = document.activeElement && document.activeElement.id;
    var y = S.root.scrollTop;
    S.root.innerHTML = '<div class="onlWrap">' + html + "</div>";
    S.root.scrollTop = y;
    if (keep) { var el = document.getElementById(keep); if (el && (el.tagName === "INPUT")) { try { el.focus(); } catch (e) {} } }
  }

  /* ---------- เปิด/ปิดหน้าต่าง ---------- */
  function ensureRoot() {
    if (S.root) return S.root;
    var d = document.createElement("div");
    d.id = "onl"; d.hidden = true; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-label", "เล่นออนไลน์");
    document.body.appendChild(d);
    d.addEventListener("click", onClick);
    d.addEventListener("input", function (e) {
      if (e.target.id === "onlCode") { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); }
    });
    S.root = d; return d;
  }
  async function open(to, code) {
    if (window.__nn && __nn.ui && __nn.ui.offlineBusy && __nn.ui.offlineBusy()) { toast("จบเกมออฟไลน์ที่กำลังเล่นอยู่ก่อน (กด ✕ ในเกม) แล้วค่อยเล่นออนไลน์"); return; }
    ensureRoot().hidden = false;
    document.documentElement.style.overflow = "hidden";
    if (!S.name) S.name = ls("hrta-onl-name") || "";
    if (!S.av) S.av = ls("hrta-onl-av") || "";
    if (!S.av && S.name && photos()[S.name]) S.av = S.name;
    if (code) S.code = code;
    if (S.rid) { S.screen = "lobby"; render(); schedule(); if (window.NNOnlineGame) NNOnlineGame.onShow(); beat(); return; }
    S.screen = to || "menu"; render();
    if (!to || to === "menu") {            // เปิดแบบปกติ: ถ้าเคยอยู่ในห้อง ให้กลับเข้าห้องเดิม
      try {
        S.screen = "loading"; render();
        await ensureAuth();
        var back = await resume(true);
        if (!back) { S.screen = "menu"; render(); }
      } catch (e) { S.screen = "menu"; render(); toast(errText(e)); }
    }
  }
  function hide() {
    if (window.NNOnlineGame) NNOnlineGame.onHide();
    if (S.root) S.root.hidden = true;
    document.documentElement.style.overflow = "";
    syncEntry();
  }
  function syncEntry() {
    var b = $("#onlOpen"); if (!b) return;
    b.textContent = S.rid && S.room ? "🌐 กลับเข้าห้อง " + S.room.code : "🌐 เล่นออนไลน์ · 2–4 คน คนละเครื่อง";
  }

  /* ---------- เหตุการณ์ ---------- */
  function onClick(e) {
    var t = e.target.closest("[data-act]"); if (!t || t.disabled) return;
    var a = t.dataset.act, v = t.dataset.v;
    if (a === "hide") return hide();
    if (a === "go") { readForm(); S.screen = v; return render(); }
    if (a === "av") {
      S.av = v; ls("hrta-onl-av", v);
      var g = $("#onlAvG"); if (g) g.querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", b.dataset.v === v); });
      return;
    }
    if (a === "cap" || a === "mode") {
      if (a === "cap") S.cap = +v; else S.mode = v;
      t.parentNode.querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", b === t); });
      var d = $("#onlModeD"); if (d) d.textContent = MODE_TXT[S.mode];
      return;
    }
    if (a === "create") return doCreate();
    if (a === "join") return doJoin();
    if (a === "reload") { subscribe(); return schedule(); }
    if (a === "share") return share();
    if (!S.rid) return;
    if (window.NNOnlineGame && window.NNOnlineGame.onClick(a, v)) return;
    if (a === "ready") { var me = mine(); return run(async function () { await rpc("nn_set_ready", { p_room: S.rid, p_ready: !(me && me.is_ready) }); await refetch(); }); }
    if (a === "scap") return run(async function () { await rpc("nn_update_settings", { p_room: S.rid, p_cap: +v, p_mode: S.room.mode }); await refetch(); });
    if (a === "smode") return run(async function () { await rpc("nn_update_settings", { p_room: S.rid, p_cap: S.room.cap, p_mode: v }); await refetch(); });
    if (a === "start") return run(async function () { var res = await callApi({ action: "start", room_id: S.rid }); if (res.error) throw new Error(res.error); await refetch(); });
    if (a === "leave") {
      if (S.room && S.room.status === "lobby" && !confirm("ออกจากห้องนี้?")) return;
      if (S.room && S.room.status === "playing" && S.game && S.game.status === "playing" && amAlive() && !confirm("ออกจากเกมกลางคัน? จะถือว่าคุณยอมแพ้")) return;
      return run(async function () { var id = S.rid; if (S.room && S.room.status === "playing" && S.game && S.game.status === "playing" && amAlive()) { try { await callApi({ action: "forfeit", game_id: S.game.id }); } catch (fe) {} } try { await rpc("nn_leave_room", { p_room: id }); } catch (er) { if (er.message !== "not_in_room") throw er; } exitRoom(); });
    }
    if (a === "close") {
      if (!confirm("ปิดห้อง? ทุกคนจะถูกเด้งออกจากห้อง")) return;
      return run(async function () { await rpc("nn_close_room", { p_room: S.rid }); await refetch(); });
    }
  }
  function share() {
    if (!S.room) return;
    var url = location.origin + location.pathname + "?room=" + S.room.code;
    var txt = "ชวนเล่นเกมเลขเพดาน HRTA 🎯 รหัสห้อง " + S.room.code + "\n" + url;
    if (navigator.share) { navigator.share({ text: txt }).catch(function () {}); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function () { toast("คัดลอกลิงก์ชวนเพื่อนแล้ว"); }, function () { toast("รหัสห้อง " + S.room.code); });
    } else toast("รหัสห้อง " + S.room.code);
  }

  /* ---------- ปุ่มทางเข้าในหน้าตั้งค่าเกมเลขเพดาน ---------- */
  function inject() {
    var B = document.getElementById("nnB");
    if (!B || !B.querySelector('[data-a="mode"]') || B.querySelector("#onlOpen")) return;
    var lb = B.querySelector(".lb"), box = document.createElement("div");
    box.className = "onlEntry";
    box.innerHTML = '<button type="button" id="onlOpen"></button><p class="nnD">เล่นพร้อมกันคนละเครื่อง ผ่านอินเทอร์เน็ต · ไม่มี AI · ยังไม่มีเหรียญรางวัล</p>';
    B.insertBefore(box, lb || null);
    syncEntry();
  }
  function init() {
    if (window.NNOnlineGame) window.NNOnlineGame.init({
      S: S, esc: esc, avImg: avImg, mine: mine, top: top, banner: banner, run: run, rpc: rpc, callApi: callApi,
      refetch: refetch, render: render, softRender: softRender, uuid: uuid,
      isHost: function () { return !!(S.room && S.room.host_user_id === S.uid); },
      skew: function () { return S.skewMs || 0; }, hide: hide
    });
    var B = document.getElementById("nnB");
    if (B) { new MutationObserver(inject).observe(B, { childList: true }); inject(); }
    document.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("#onlOpen")) open(); });
    window.addEventListener("online", function () { S.net = true; if (S.rid) { subscribe(); beat(); schedule(); } render(); });
    window.addEventListener("offline", function () { S.net = false; render(); });
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState !== "visible" || !S.rid) return;
      if (!S.ch || S.ch.state !== "joined") subscribe();
      beat(); schedule();
    });
    // ลิงก์ชวนเพื่อน ?room=CODE
    try {
      var m = /[?&]room=([A-Za-z0-9]{6})\b/.exec(location.search);
      if (m) { history.replaceState(null, "", location.pathname + location.hash); open("join", m[1].toUpperCase()); }
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();

  // เปิดให้ทดสอบ/ดีบักจากคอนโซล (ไม่มีข้อมูลลับ)
  window.HRTAOnline = { open: open, state: S };
})();
