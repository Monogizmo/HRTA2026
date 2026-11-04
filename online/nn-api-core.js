/* HRTA Number Ceiling — API orchestration. UID is always taken from the verified JWT. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./nn-server.js"));
  else root.NNApi = factory(root.NNServer);
})(typeof self !== "undefined" ? self : this, function (SV) {
  "use strict";
  var TURN_MS = 60000;
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function create(deps) {
    var admin = deps.admin, rnd = deps.rnd, now = deps.now || function () { return Date.now(); };
    var log = deps.log || function () {};
    async function q(promise) { var r = await promise; if (r.error) throw new Error("db: " + r.error.message); return r.data; }
    function deadline() { return new Date(now() + TURN_MS).toISOString(); }

    async function start(uid, b) {
      if (!UUID.test(String(b.room_id || ""))) return { error: "bad_request" };
      var room = await q(admin.from("rooms").select("*").eq("id", b.room_id).maybeSingle());
      if (!room) return { error: "room_not_found" };
      if (room.host_user_id !== uid) return { error: "not_host" };
      if (room.status !== "lobby") return { error: "room_started" };
      var ps = await q(admin.from("room_players").select("*").eq("room_id", room.id).is("left_at", null).order("seat"));
      if (ps.length < 2 || ps.length > 4) return { error: "bad_player_count" };
      if (ps.some(function (p) { return !p.is_ready; })) return { error: "not_all_ready" };
      var g = SV.startGame(ps.map(function (p) { return { user_id: p.user_id, seat: p.seat, name: p.player_name, avatar: p.avatar }; }), room.cap, rnd, room.mode);
      if (g.error) return { error: g.error };
      var res = await q(admin.rpc("nn_commit_start", {
        p_room: room.id, p_host: uid, p_public: g.pub, p_secret: g.secret, p_hands: g.hands,
        p_cur: g.cur, p_deadline: deadline()
      }));
      if (res && res.error) return { error: res.error };
      return { ok: true, game_id: res.game_id };
    }

    async function loadGame(uid, b) {
      if (!UUID.test(String(b.game_id || ""))) return { error: "bad_request" };
      var game = await q(admin.from("games").select("*").eq("id", b.game_id).maybeSingle());
      if (!game) return { error: "game_not_found" };
      var mem = await q(admin.from("room_players").select("user_id").eq("room_id", game.room_id).eq("user_id", uid).is("left_at", null));
      if (!mem.length) return { error: "not_in_game" };
      if (game.status !== "playing") return { state: "over", game: game };
      var sec = await q(admin.from("game_secrets").select("deck,disc").eq("game_id", game.id).maybeSingle());
      var rows = await q(admin.from("player_private_states").select("user_id,seat,hand,pending").eq("game_id", game.id));
      if (!sec || !rows.length) return { error: "game_not_found" };
      var pub = game.public_state, uids = [], hands = {}, privateStates = {};
      pub.players.slice().sort(function (a, b) { return a.p - b.p; }).forEach(function (pl, p) {
        var row = rows.filter(function (r) { return r.seat === pl.seat; })[0];
        uids[p] = row ? row.user_id : null;
      });
      if (uids.some(function (u) { return !u; })) return { error: "server_error" };
      rows.forEach(function (r) { hands[r.user_id] = r.hand; privateStates[r.user_id] = { hand: r.hand, pending: r.pending || null, sunOptions: r.pending && r.pending.sunOptions ? r.pending.sunOptions : null }; });
      return { game: game, uids: uids, hands: hands, private: privateStates, secret: sec };
    }

    async function mutate(uid, b, type, apply) {
      if (!UUID.test(String(b.game_id || "")) || !UUID.test(String(b.request_id || "")) || !Number.isInteger(b.expected_version)) return { error: "bad_request" };
      var L = await loadGame(uid, b); if (L.error || L.state) return L.error ? L : { error: "game_over" };
      var game = L.game;
      if (game.version !== b.expected_version) {
        var seen = await q(admin.from("game_actions").select("seq").eq("game_id", game.id).eq("request_id", b.request_id));
        if (seen.length) return { ok: true, dup: true, version: game.version };
        return { error: "stale", version: game.version };
      }
      var snap = { pub: game.public_state, secret: L.secret, hands: L.hands, private: L.private, uids: L.uids };
      var out = apply(snap);
      if (out.error) return out;
      var res = await q(admin.rpc("nn_commit_action", {
        p_game: game.id, p_expected: b.expected_version, p_user: uid, p_request: b.request_id,
        p_public: out.pub, p_secret: out.secret, p_hands: out.private || {}, p_cur: out.cur, p_over: out.over,
        p_deadline: out.over >= 0 ? null : (out.cur === game.cur_p ? game.turn_deadline_at : deadline()), p_action: out.action || { type: type }, p_type: type
      }));
      if (res && res.error) return res.error === "stale" ? { error: "stale", version: res.version } : { error: res.error };
      return { ok: true, version: res.version, dup: !!res.dup };
    }

    async function play(uid, b) {
      if (!Number.isInteger(b.card_id) || (b.choice != null && (typeof b.choice !== "object" || Array.isArray(b.choice)))) return { error: "bad_request" };
      return mutate(uid, b, "play", function (snap) { return SV.applyPlay(snap, uid, b.card_id, rnd, b.choice || {}); });
    }
    async function interrupt(uid, b) {
      if (!Number.isInteger(b.card_id)) return { error: "bad_request" };
      return mutate(uid, b, "interrupt", function (snap) { return SV.applyInterrupt(snap, uid, b.card_id, rnd); });
    }
    async function choose(uid, b) {
      if (!Number.isInteger(b.index)) return { error: "bad_request" };
      return mutate(uid, b, "choose", function (snap) { return SV.applyChoose(snap, uid, b.index, rnd); });
    }
    async function skip(uid, b) {
      return mutate(uid, b, "skip", function (snap) { return SV.applySkip(snap, uid, rnd); });
    }

    /* ---- timeout / disconnect / leaving: same elimination path as Phase 3 ---- */
    var HB_FRESH_MS = 45000, RECONNECT_MS = 120000;
    async function forfeitPlayer(L, orig, reason, caller) {
      var game = L.game;
      var snap = { pub: game.public_state, secret: L.secret, hands: L.hands, private: L.private, uids: L.uids };
      var out = SV.applyForfeit(snap, orig, reason, rnd);
      if (out.error === "eliminated") return { ok: true, state: "out" };
      if (out.error) return { error: out.error };
      var uuid = deps.uuid ? deps.uuid() : (globalThis.crypto && globalThis.crypto.randomUUID ? globalThis.crypto.randomUUID() : null);
      if (!uuid) return { error: "server_error" };
      var res = await q(admin.rpc("nn_commit_action", {
        p_game: game.id, p_expected: game.version, p_user: caller, p_request: uuid,
        p_public: out.pub, p_secret: out.secret, p_hands: out.private || {}, p_cur: out.cur, p_over: out.over,
        p_deadline: out.over >= 0 ? null : (out.cur === game.cur_p ? game.turn_deadline_at : deadline()), p_action: out.action, p_type: "forfeit"
      }));
      if (res && res.error === "stale") return { ok: true, state: "stale" };
      if (res && res.error === "game_over") return { ok: true, state: "over" };
      if (res && res.error) return { error: res.error };
      return { ok: true, state: out.over >= 0 ? "forfeited" : "eliminated", loser: orig, reason: reason, over: out.over >= 0 };
    }
    async function check(uid, b) {
      var L = await loadGame(uid, b); if (L.error || L.state) return L.error ? L : { ok: true, state: "over" };
      var game = L.game, pub = game.public_state, curUid = L.uids[pub.cur];
      var hb = await q(admin.from("player_heartbeats").select("user_id,last_seen_at").eq("room_id", game.room_id).eq("user_id", curUid));
      var seen = hb.length ? Date.parse(hb[0].last_seen_at) : (Date.parse(game.updated_at || game.created_at) || 0);
      var t = now(), dl = Date.parse(game.turn_deadline_at) || 0, connected = (t - seen) <= HB_FRESH_MS;
      var eff = connected ? dl : Math.max(dl, seen + RECONNECT_MS);
      if (t <= eff) return { ok: true, state: "waiting", remaining_ms: eff - t, connected: connected };
      return await forfeitPlayer(L, pub.cur, connected ? "timeout" : "disconnected", uid);
    }
    async function forfeit(uid, b) {
      var L = await loadGame(uid, b); if (L.error || L.state) return L.error ? L : { ok: true, state: "over" };
      var p = L.uids.indexOf(uid); if (p < 0) return { error: "not_in_game" };
      return forfeitPlayer(L, p, "left", uid);
    }
    async function handle(uid, body) {
      try {
        if (!uid || !body || typeof body !== "object") return { error: "bad_request" };
        if (body.action === "start") return await start(uid, body);
        if (body.action === "play") return await play(uid, body);
        if (body.action === "interrupt") return await interrupt(uid, body);
        if (body.action === "choose") return await choose(uid, body);
        if (body.action === "skip") return await skip(uid, body);
        if (body.action === "check") return await check(uid, body);
        if (body.action === "forfeit") return await forfeit(uid, body);
        return { error: "bad_action" };
      } catch (e) { log("nn-api error", e && e.message); return { error: "server_error" }; }
    }
    return { handle: handle };
  }
  return { create: create, TURN_MS: TURN_MS };
});
