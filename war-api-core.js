/* HRTA สงครามไพ่ยุทธวิธี — แกน Edge Function ส่วนของเกมนี้ (เรียกผ่าน nn-api-core: action ขึ้นต้นด้วย war_)
 * deps = { admin: supabase client แบบ service_role, rnd, now?, log?, uuid? } · handle(uid, body) -> object เสมอ
 * uid ต้องมาจากการตรวจ JWT ชั้นนอก ไม่เชื่อค่าจาก body
 * ข้อกำหนด: ตัดสิน 60 วินาที/การเลือก · หลุดสัญญาณรอ 120 วินาที · หมดเวลา/ออก = ยอมแพ้ · ไม่มี AI แทนผู้เล่น
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./war-server.js"));
  else root.WarApi = factory(root.WarServer);
})(typeof self !== "undefined" ? self : this, function (SV) {
  "use strict";
  var TURN_MS = 60000, HB_FRESH_MS = 45000, RECONNECT_MS = 120000;
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function create(deps) {
    var admin = deps.admin, rnd = deps.rnd;
    var now = deps.now || function () { return Date.now(); };
    var log = deps.log || function () {};
    async function q(promise) { var r = await promise; if (r.error) throw new Error("db: " + r.error.message); return r.data; }
    function deadline() { return new Date(now() + TURN_MS).toISOString(); }
    function newUuid() { return deps.uuid ? deps.uuid() : (globalThis.crypto && globalThis.crypto.randomUUID ? globalThis.crypto.randomUUID() : null) }

    async function start(uid, b) {
      if (!UUID.test(String(b.room_id || ""))) return { error: "bad_request" };
      var room = await q(admin.from("rooms").select("*").eq("id", b.room_id).maybeSingle());
      if (!room) return { error: "room_not_found" };
      if (room.game_type !== "war") return { error: "wrong_game" };
      if (room.host_user_id !== uid) return { error: "not_host" };
      if (room.status !== "lobby") return { error: "room_started" };
      var ps = await q(admin.from("room_players").select("*").eq("room_id", room.id).is("left_at", null).order("seat"));
      if (ps.length !== 2) return { error: "bad_player_count" };
      if (ps.some(function (p) { return !p.is_ready })) return { error: "not_all_ready" };
      var g = SV.startGame(ps.map(function (p) { return { user_id: p.user_id, seat: p.seat, name: p.player_name, avatar: p.avatar } }), room.war_cfg, rnd);
      if (g.error) return { error: g.error };
      var res = await q(admin.rpc("war_commit_start", { p_room: room.id, p_host: uid, p_public: g.pub, p_secret: g.secret, p_hands: g.hands, p_deadline: deadline() }));
      if (res && res.error) return { error: res.error };
      return { ok: true, game_id: res.game_id };
    }

    async function loadGame(uid, b, needSecret) {
      if (!UUID.test(String(b.game_id || ""))) return { error: "bad_request" };
      var game = await q(admin.from("games").select("*").eq("id", b.game_id).maybeSingle());
      if (!game) return { error: "game_not_found" };
      var mem = await q(admin.from("room_players").select("user_id").eq("room_id", game.room_id).eq("user_id", uid).is("left_at", null));
      if (!mem.length) return { error: "not_in_game" };
      if (game.status !== "playing") return { ok: true, state: "over", game: game };
      var sec = await q(admin.from("game_secrets").select("deck,disc,pend").eq("game_id", game.id).maybeSingle());
      var rows = await q(admin.from("player_private_states").select("user_id,seat,hand").eq("game_id", game.id));
      if (!sec || !rows.length) return { error: "game_not_found" };
      var uids = [], hands = {};
      game.public_state.players.forEach(function (pl, p) { var row = rows.filter(function (r) { return r.seat === pl.seat })[0]; uids[p] = row ? row.user_id : null });
      if (uids.some(function (u) { return !u })) return { error: "server_error" };
      rows.forEach(function (r) { hands[r.user_id] = r.hand });
      return { game: game, uids: uids, snap: { pub: game.public_state, secret: { deck: sec.deck, rest: sec.disc, pend: sec.pend || [null, null] }, hands: hands, uids: uids } };
    }

    async function choose(uid, b) {
      if (!UUID.test(String(b.request_id || "")) || !Number.isInteger(b.expected_version) || !b.choice || typeof b.choice !== "object") return { error: "bad_request" };
      var L = await loadGame(uid, b); if (L.error) return L;
      if (L.state === "over") return { error: "game_over" };
      var game = L.game;
      if (game.version !== b.expected_version) {
        var seen = await q(admin.from("game_actions").select("seq").eq("game_id", game.id).eq("request_id", b.request_id));
        if (seen.length) return { ok: true, dup: true, version: game.version };
        return { error: "stale", version: game.version };
      }
      var out = SV.applyChoice(L.snap, uid, b.choice, rnd);
      if (out.error) return { error: out.error };
      var res = await q(admin.rpc("war_commit", {
        p_game: game.id, p_expected: b.expected_version, p_user: uid, p_request: b.request_id,
        p_public: out.pub, p_secret: out.secret, p_hands: out.hands, p_over: out.over,
        p_deadline: out.resolved ? deadline() : game.turn_deadline_at, p_type: out.type
      }));
      if (res && res.error) return res.error === "stale" ? { error: "stale", version: res.version } : { error: res.error };
      return { ok: true, version: res.version, dup: !!res.dup, resolved: !!out.resolved };
    }

    async function forfeitCommit(L, idx, reason, caller) {
      var out = SV.applyForfeit(L.snap, idx, reason);
      if (out.error) return { error: out.error };
      var res = await q(admin.rpc("war_commit", {
        p_game: L.game.id, p_expected: L.game.version, p_user: caller, p_request: newUuid(),
        p_public: out.pub, p_secret: out.secret, p_hands: out.hands, p_over: out.over, p_deadline: deadline(), p_type: "forfeit"
      }));
      if (res && res.error === "stale") return { ok: true, state: "stale" };
      if (res && res.error === "game_over") return { ok: true, state: "over" };
      if (res && res.error) return { error: res.error };
      return { ok: true, state: idx < 0 ? "abandoned" : "forfeited", loser: idx, reason: reason, over: true };
    }

    // ใครก็ตามในเกมเรียกได้ แต่เซิร์ฟเวอร์ตัดสินจากเวลา/heartbeat เอง (เรียกเร็วเกินไปไม่มีผล)
    async function check(uid, b) {
      var L = await loadGame(uid, b); if (L.error) return L; if (L.state === "over") return { ok: true, state: "over" };
      var game = L.game, pend = L.snap.secret.pend, slow = [];
      for (var p = 0; p < 2; p++) if (!pend[p]) slow.push(p);
      if (!slow.length) return { ok: true, state: "waiting", remaining_ms: 0 };
      var t = now(), dl = Date.parse(game.turn_deadline_at) || 0, late = [], minRemain = Infinity, anyConnected = false;
      for (var i = 0; i < slow.length; i++) {
        var p2 = slow[i], hb = await q(admin.from("player_heartbeats").select("user_id,last_seen_at").eq("room_id", game.room_id).eq("user_id", L.uids[p2]));
        var seen = hb.length ? Date.parse(hb[0].last_seen_at) : (Date.parse(game.updated_at || game.created_at) || 0);
        var connected = (t - seen) <= HB_FRESH_MS, eff = connected ? dl : Math.max(dl, seen + RECONNECT_MS);
        if (connected) anyConnected = true;
        if (t > eff) late.push({ p: p2, reason: connected ? "timeout" : "disconnected" }); else minRemain = Math.min(minRemain, eff - t);
      }
      if (!late.length) return { ok: true, state: "waiting", remaining_ms: minRemain };
      if (late.length === 2) return await forfeitCommit(L, -1, "both_idle", uid);   // ทั้งคู่ไม่เลือก = ทิ้งเกม เสมอ
      return await forfeitCommit(L, late[0].p, late[0].reason, uid);
    }

    // ผู้เล่นกดออกจากเกมกลางคัน = ยอมแพ้
    async function forfeit(uid, b) {
      var L = await loadGame(uid, b); if (L.error) return L; if (L.state === "over") return { ok: true, state: "over" };
      var p = L.uids.indexOf(uid); if (p < 0) return { error: "not_in_game" };
      return await forfeitCommit(L, p, "left", uid);
    }

    async function handle(uid, body) {
      try {
        if (!uid || !body || typeof body !== "object") return { error: "bad_request" };
        if (body.action === "war_start") return await start(uid, body);
        if (body.action === "war_choose") return await choose(uid, body);
        if (body.action === "war_check") return await check(uid, body);
        if (body.action === "war_forfeit") return await forfeit(uid, body);
        return { error: "bad_action" };
      } catch (e) { log("war-api error", e && e.message); return { error: "server_error" } }
    }
    return { handle: handle };
  }
  return { create: create, TURN_MS: TURN_MS };
});
