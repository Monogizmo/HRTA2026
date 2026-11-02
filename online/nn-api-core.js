/* HRTA Number Ceiling — แกนของ Edge Function `nn-api` (ไม่ผูกกับ Deno/Supabase โดยตรง จึงทดสอบบน Node ได้)
 * deps = { admin: supabase client แบบ service_role, rnd: ตัวสุ่มปลอดภัย, now?: () => ms }
 * handle(uid, body) -> object เสมอ (ความผิดพลาดที่คาดได้ส่งเป็น { error: "code" } ไม่ throw)
 * uid ต้องมาจากการตรวจ JWT ในชั้นนอก (index.ts) ไม่เคยเชื่อค่าจาก body
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./nn-server.js"));
  else root.NNApi = factory(root.NNServer);
})(typeof self !== "undefined" ? self : this, function (SV) {
  "use strict";
  var TURN_MS = 60000;
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function create(deps) {
    var admin = deps.admin, rnd = deps.rnd;
    var now = deps.now || function () { return Date.now(); };
    var log = deps.log || function () {};

    async function q(promise) {
      var r = await promise;
      if (r.error) throw new Error("db: " + r.error.message);
      return r.data;
    }
    function deadline() { return new Date(now() + TURN_MS).toISOString(); }

    async function start(uid, b) {
      if (!UUID.test(String(b.room_id || ""))) return { error: "bad_request" };
      var room = await q(admin.from("rooms").select("*").eq("id", b.room_id).maybeSingle());
      if (!room) return { error: "room_not_found" };
      if (room.host_user_id !== uid) return { error: "not_host" };
      if (room.status !== "lobby") return { error: "room_started" };
      if (room.mode !== "one_loser") return { error: "mode_not_ready" };
      var ps = await q(admin.from("room_players").select("*").eq("room_id", room.id).is("left_at", null).order("seat"));
      if (ps.length < 2 || ps.length > 4) return { error: "bad_player_count" };
      if (ps.some(function (p) { return !p.is_ready; })) return { error: "not_all_ready" };

      var g = SV.startGame(ps.map(function (p) {
        return { user_id: p.user_id, seat: p.seat, name: p.player_name, avatar: p.avatar };
      }), room.cap, rnd);
      if (g.error) return { error: g.error };
      var res = await q(admin.rpc("nn_commit_start", {
        p_room: room.id, p_host: uid, p_public: g.pub, p_secret: g.secret, p_hands: g.hands,
        p_cur: g.cur, p_deadline: deadline()
      }));
      if (res && res.error) return { error: res.error };
      return { ok: true, game_id: res.game_id };
    }

    async function play(uid, b) {
      if (!UUID.test(String(b.game_id || "")) || !UUID.test(String(b.request_id || ""))) return { error: "bad_request" };
      if (!Number.isInteger(b.card_id) || !Number.isInteger(b.expected_version)) return { error: "bad_request" };
      var game = await q(admin.from("games").select("*").eq("id", b.game_id).maybeSingle());
      if (!game) return { error: "game_not_found" };
      var mem = await q(admin.from("room_players").select("user_id").eq("room_id", game.room_id).eq("user_id", uid).is("left_at", null));
      if (!mem.length) return { error: "not_in_game" };
      if (game.status !== "playing") return { error: "game_over" };
      if (game.version !== b.expected_version) {
        // ถ้าเป็นคำขอเดิมที่สำเร็จไปแล้ว (เน็ตส่งซ้ำ/กดซ้ำ) ให้ตอบว่าสำเร็จ ไม่ใช่ stale
        var seen = await q(admin.from("game_actions").select("seq").eq("game_id", game.id).eq("request_id", b.request_id));
        if (seen.length) return { ok: true, dup: true, version: game.version };
        return { error: "stale", version: game.version };
      }

      var sec = await q(admin.from("game_secrets").select("deck,disc").eq("game_id", game.id).maybeSingle());
      var rows = await q(admin.from("player_private_states").select("user_id,seat,hand").eq("game_id", game.id));
      if (!sec || !rows.length) return { error: "game_not_found" };

      var pub = game.public_state, hands = {}, uids = [];
      pub.players.forEach(function (pl, p) {
        var row = rows.filter(function (r) { return r.seat === pl.seat; })[0];
        uids[p] = row ? row.user_id : null;
      });
      if (uids.some(function (u) { return !u; })) return { error: "server_error" };
      rows.forEach(function (r) { hands[r.user_id] = r.hand; });

      var out = SV.applyPlay({ pub: pub, secret: sec, hands: hands, uids: uids }, uid, b.card_id, rnd);
      if (out.error) return { error: out.error };
      var res = await q(admin.rpc("nn_commit_action", {
        p_game: game.id, p_expected: b.expected_version, p_user: uid, p_request: b.request_id,
        p_public: out.pub, p_secret: out.secret, p_hands: out.hands, p_cur: out.cur, p_over: out.over,
        p_deadline: deadline(), p_action: out.action
      }));
      if (res && res.error) return res.error === "stale" ? { error: "stale", version: res.version } : { error: res.error };
      return { ok: true, version: res.version, dup: !!res.dup };
    }

    async function handle(uid, body) {
      try {
        if (!uid || !body || typeof body !== "object") return { error: "bad_request" };
        if (body.action === "start") return await start(uid, body);
        if (body.action === "play") return await play(uid, body);
        return { error: "bad_action" };
      } catch (e) {
        log("nn-api error", e && e.message);
        return { error: "server_error" };
      }
    }
    return { handle: handle };
  }
  return { create: create, TURN_MS: TURN_MS };
});
