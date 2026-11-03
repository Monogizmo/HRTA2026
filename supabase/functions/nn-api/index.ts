// @ts-nocheck
// ไฟล์นี้สร้างอัตโนมัติจาก tools/build-edge.js — อย่าแก้ตรง ๆ (แก้ที่ online/*.js หรือ tools/edge-main.ts แล้วรัน: node tools/build-edge.js)
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
const self = globalThis;

/* ===== online/nn-engine.js ===== */
/* HRTA Number Ceiling engine — ไฟล์ใช้ร่วม client + server (Supabase Edge Function)
 * ส่วน `function nnEngine` คัดลอกตรงตัวจาก index.html (ห้ามแก้กติกาที่นี่ — ถ้าต้องแก้กติกาจริง ให้แก้ใน index.html แล้วคัดลอกมาใหม่)
 * tests/engine-parity.test.js ตรวจว่าไฟล์นี้ยังเหมือน engine ใน index.html ทุกตา
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NNEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  var RES=[0,9,11,12,13,16,17,18,20];
  function nnEngine(o,rnd){rnd=rnd||Math.random;
   var G={cap:o.cap,n:o.n,two:o.n===2,hands:[],deck:[],disc:[],total:0,prev:0,dir:1,cur:0,over:-1,turn:0,band:9,shield:[],dbl:null,force:-1,heatAt:Math.round(o.cap/6)};
   G.heat=function(){return G.turn>=G.heatAt?1+Math.floor((G.turn-G.heatAt)/6):0};
   var shuf=function(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(rnd()*(i+1)),t=a[i];a[i]=a[j];a[j]=t}return a};
   var scr=function(t){return Math.floor(t/100)*100+(t%10)*10+Math.floor((t%100)/10)};
   G.deal=function(){var d=[];for(var k=0;k<2;k++)for(var n=0;n<22;n++)d.push({n:n,id:k*22+n});G.deck=shuf(d);G.disc=[];G.hands=[];G.shield=[];for(var p=0;p<G.n;p++){G.hands.push(G.deck.splice(0,3));G.shield.push(false)}};
   G.draw=function(p){if(!G.deck.length)G.deck=shuf(G.disc.splice(0));if(G.deck.length)G.hands[p].push(G.deck.shift())};
   G.low=function(p){var h=G.hands[p],m=0;h.forEach(function(c,i){if(c.n<h[m].n)m=i});return m};
   G.dump=function(p){var h=G.hands[p];if(!h.length)return;var m=0;h.forEach(function(c,i){if(c.n>h[m].n)m=i});G.disc.push(h.splice(m,1)[0]);G.draw(p)};
   G.dumpLow=function(p){var h=G.hands[p];if(!h.length)return;G.disc.push(h.splice(G.low(p),1)[0]);G.draw(p)};
   G.next=function(p){return((p+G.dir)%G.n+G.n)%G.n};
   G.legal=function(p){var h=G.hands[p],ix=[],mx=-1;h.forEach(function(c){if(c.n>mx)mx=c.n});h.forEach(function(c,i){if(G.force!==p||c.n===mx)ix.push(i)});return ix};
   /* พลังไพ่ (2 คน กับ 3-4 คน ต่างกันที่ 0, 3, 4, 7, 21) */
   G.opts=function(n){var two=G.two,c=G.cap,t=G.total,hf=t+Math.floor((c-t)/2);switch(n){
    case 0:return[{t:two?"+0 รีเซ็ตมือ":"+0 รีเซ็ตทิศ",v:0,fx:"fool"}];
    case 1:return[{t:"+1 เสกไพ่ปีศาจ",v:1,fx:"conj"}];
    case 2:return[{t:"ปั่นเลข → "+scr(t),set:scr(t)}];
    case 3:return[two?{t:"+3",v:3}:{t:"+3 ข้ามคน",v:3,fx:"skip"}];
    case 4:return[two?{t:"+4",v:4}:{t:"+0 ย้อนทิศ",v:0,fx:"rev"}];
    case 5:return[{t:"+5 ริบไพ่ต่ำสุด",v:5,fx:"rob"}];
    case 6:return[{t:"+6 บังคับใบสูงสุด",v:6,fx:"force"}];
    case 7:return[two?{t:"+7",v:7}:{t:"+7 ย้อนทิศ",v:7,fx:"rev"}];
    case 8:return[{t:"คูณสอง → "+t*2,set:t*2}];
    case 9:return[{t:"+9 รับโล่",v:9,fx:"shield"}];
    case 10:return[{t:"ปั่นวงล้อ −15…+25",v:0,fx:"wheel"}];
    case 11:return[{t:"เฉือนครึ่ง → "+Math.floor(t/2),set:Math.floor(t/2)}];
    case 12:return[{t:"กลับกอง → "+Math.max(0,c-t),set:Math.max(0,c-t)}];
    case 13:return[{t:"ย้อนเวลา → "+G.prev,set:G.prev}];
    case 14:return[{t:"ดันครึ่งทาง → "+hf,set:hf}];
    case 15:return[{t:"+15 คนต่อไปลง 2",v:15,fx:"devil"}];
    case 16:return[{t:"ล้างกอง → 0",set:0}];
    case 17:return[{t:"−10",v:-10}];
    case 18:return[{t:"+0 สลับมือ",v:0,fx:"swap"}];
    case 19:return[{t:"+19 ลงซ้ำ",v:19,fx:"again"}];
    case 20:return[{t:"+20 ทุกคนล้างไพ่",v:20,fx:"all"}];
    case 21:return[{t:"ดันเป็น "+(two?c-10:c),set:two?c-10:c}];
    default:return[{t:"+"+n,v:n}]}};
   G.play=function(p,i,k){if(G.force===p)G.force=-1;
    var c=G.hands[p].splice(i,1)[0],o=G.opts(c.n)[k],b=G.total,fx=o.fx||"",saved=false,nx=G.next(p);
    var t=o.set!=null?o.set:Math.max(0,b+o.v);if(fx==="wheel")t=Math.max(0,b+Math.floor(rnd()*41)-15);
    var hh=G.heat();t+=hh;
    if(t>G.cap&&G.shield[p]){G.shield[p]=false;saved=true;t=Math.max(0,G.cap-15)}
    G.total=t;G.prev=b;G.disc.push(c);G.turn++;
    var r={heat:hh,p:p,c:c,o:o,before:b,after:t,fx:fx,nx:nx,saved:saved,bust:t>G.cap};
    if(r.bust){G.over=p;return r}
    var nd=1;
    if(fx==="rev")G.dir=-G.dir;
    if(fx==="shield")G.shield[p]=true;
    if(fx==="fool"){if(G.two){G.disc.push.apply(G.disc,G.hands[p].splice(0));nd=3}else G.dir=1}
    if(fx==="all")for(var q=0;q<G.n;q++)G.dump(q);
    if(fx==="rob")G.dumpLow(nx);
    if(fx==="force")G.force=nx;
    if(fx==="conj"){var h2=G.hands[nx],m=G.low(nx);G.disc.push(h2[m]);h2[m]={n:15,id:900+G.turn}}
    for(var j=0;j<nd;j++)G.draw(p);
    if(fx==="swap"){var tmp=G.hands[p];G.hands[p]=G.hands[nx];G.hands[nx]=tmp}
    if(fx==="devil")G.dbl={p:nx,left:2};
    var st=fx==="skip"?2:fx==="again"?0:1;
    if(G.dbl&&G.dbl.p===p&&fx!=="devil"){G.dbl.left--;if(G.dbl.left>0)st=0;else G.dbl=null}
    G.cur=((G.cur+G.dir*st)%G.n+G.n)%G.n;return r};
   G.ai=function(p){var best=null,bs=-1e9,hh=G.heat();
    G.legal(p).forEach(function(i){var c=G.hands[p][i];G.opts(c.n).forEach(function(o,k){var w=o.fx==="wheel",t=(o.set!=null?o.set:w?G.total+5:Math.max(0,G.total+o.v))+hh,s;
     if(t>G.cap){s=G.shield[p]?G.cap-15-30+rnd()*4:-1000-(t-G.cap)}
     else{s=t+rnd()*7;if(RES.indexOf(c.n)>=0&&t<G.cap-25)s-=16;if(c.n===21)s+=4;if(w&&G.total+25+hh>G.cap)s-=40}
     if(s>bs){bs=s;best={i:i,k:k}}})});return best};
   return G}

  /* ---- ส่วนเสริม (ไม่อยู่ใน engine เดิม): แปลง state เป็น JSON เพื่อเก็บใน DB ---- */
  var KEYS = ["cap", "n", "two", "hands", "deck", "disc", "total", "prev", "dir", "cur", "over", "turn", "shield", "dbl", "force", "heatAt"];
  function exportState(G) {
    var s = {};
    KEYS.forEach(function (k) { s[k] = G[k]; });
    return JSON.parse(JSON.stringify(s));
  }
  function importState(s, rnd) {
    var G = nnEngine({ cap: s.cap, n: s.n }, rnd);
    var c = JSON.parse(JSON.stringify(s));
    KEYS.forEach(function (k) { if (c[k] !== undefined) G[k] = c[k]; });
    return G;
  }
  return { engine: nnEngine, exportState: exportState, importState: importState };
});

/* ===== online/nn-server.js ===== */
/* HRTA Number Ceiling — ตรรกะฝั่งเซิร์ฟเวอร์ (ฟังก์ชันล้วน ไม่แตะ DB/เครือข่าย จึงทดสอบบน Node ได้)
 * ใช้โดย Supabase Edge Function `nn-api` เท่านั้น  ตัวสุ่ม rnd ต้องมาจากเซิร์ฟเวอร์ (crypto)
 * ข้อมูลแบ่ง 3 ชั้น:  pub = สาธารณะ (ทุกคนในห้องเห็น) · hands = มือของแต่ละคน (เห็นเฉพาะเจ้าของ) · secret = สำรับ/กองทิ้ง (ไม่มีใครเห็น)
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./nn-engine.js"));
  else root.NNServer = factory(root.NNEngine);
})(typeof self !== "undefined" ? self : this, function (NN) {
  "use strict";
  var LOG_MAX = 8;

  function copy(x) { return JSON.parse(JSON.stringify(x)); }

  // สร้างสถานะสาธารณะจาก engine ที่กำลังเล่น
  function pubFrom(G, players, last, log) {
    return {
      v: 1, cap: G.cap, n: G.n, two: G.two, heatAt: G.heatAt,
      total: G.total, prev: G.prev, dir: G.dir, cur: G.cur, turn: G.turn, heat: G.heat(),
      shield: G.shield.slice(), dbl: G.dbl ? { p: G.dbl.p, left: G.dbl.left } : null,
      force: G.force, over: G.over,
      handCounts: G.hands.map(function (h) { return h.length; }),
      players: players, last: last || null, log: log || []
    };
  }

  /* เริ่มเกม: players = [{user_id, seat, name, avatar}] (2–4 คน) ; p (ลำดับใน engine) = ลำดับที่นั่งจากน้อยไปมาก */
  function startGame(players, cap, rnd) {
    var ps = players.slice().sort(function (a, b) { return a.seat - b.seat; });
    var n = ps.length;
    if (n < 2 || n > 4) return { error: "bad_player_count" };
    if ([120, 150, 200].indexOf(cap) < 0) return { error: "bad_cap" };
    var G = NN.engine({ cap: cap, n: n }, rnd);
    G.deal();
    G.cur = Math.floor(rnd() * n);                       // สุ่มคนเริ่ม (ฝั่งเซิร์ฟเวอร์)
    var pl = ps.map(function (x, p) { return { p: p, seat: x.seat, name: x.name, avatar: x.avatar }; });
    var hands = {};
    ps.forEach(function (x, p) { hands[x.user_id] = G.hands[p]; });
    return {
      pub: pubFrom(G, pl, null, []),
      secret: { deck: G.deck, disc: G.disc },
      hands: hands,
      uids: ps.map(function (x) { return x.user_id; }),
      cur: G.cur
    };
  }

  /* ลงไพ่ 1 ใบ
   * snap = { pub, secret:{deck,disc}, hands:{uid:[card]}, uids:[uid ตามลำดับ p] }
   * คืน { error } หรือ { pub, secret, hands(เฉพาะที่เปลี่ยน), cur, over, action } */
  function applyPlay(snap, uid, cardId, rnd) {
    var pub = snap.pub;
    if (!pub || pub.over >= 0) return { error: "game_over" };
    var p = snap.uids.indexOf(uid);
    if (p < 0) return { error: "not_in_game" };
    if (pub.cur !== p) return { error: "not_your_turn" };
    var mine = snap.hands[uid] || [];
    var i = -1;
    for (var k = 0; k < mine.length; k++) if (mine[k].id === cardId) { i = k; break; }
    if (i < 0) return { error: "card_not_in_hand" };

    var st = {
      cap: pub.cap, n: pub.n, two: pub.two, heatAt: pub.heatAt, total: pub.total, prev: pub.prev,
      dir: pub.dir, cur: pub.cur, over: pub.over, turn: pub.turn, shield: pub.shield, dbl: pub.dbl, force: pub.force,
      deck: snap.secret.deck, disc: snap.secret.disc,
      hands: snap.uids.map(function (u) { return snap.hands[u]; })
    };
    var G = NN.importState(st, rnd);
    if (G.legal(p).indexOf(i) < 0) return { error: "illegal_card" };

    var r = G.play(p, i, 0);
    var last = {
      seq: pub.turn, p: p, n: r.c.n, id: r.c.id, t: r.o.t, before: r.before, after: r.after,
      heat: r.heat, fx: r.fx, saved: r.saved, bust: r.bust, nx: r.nx
    };
    var log = (pub.log || []).concat([last]).slice(-LOG_MAX);
    var npub = pubFrom(G, pub.players, last, log);

    var changed = {};
    snap.uids.forEach(function (u, q) {
      if (JSON.stringify(snap.hands[u]) !== JSON.stringify(G.hands[q])) changed[u] = G.hands[q];
    });
    return {
      pub: npub, secret: { deck: G.deck, disc: G.disc }, hands: changed,
      cur: G.cur, over: G.over, action: { p: p, card_id: cardId, last: last }
    };
  }

  /* สถิติท้ายเกม (สาธารณะ) */
  function summary(pub) {
    return { loser: pub.over, turns: pub.turn, total: pub.last ? pub.last.after : pub.total, cap: pub.cap };
  }

  return { startGame: startGame, applyPlay: applyPlay, summary: summary, copy: copy };
});

/* ===== online/nn-api-core.js ===== */
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

    /* ---- Phase 3: หมดเวลา / หลุดการเชื่อมต่อ / ออกจากเกม = ผู้เล่นนั้นยอมแพ้ (เกมจบ) ---- */
    var HB_FRESH_MS = 45000, RECONNECT_MS = 120000;

    async function loadGame(uid, b) {
      if (!UUID.test(String(b.game_id || ""))) return { error: "bad_request" };
      var game = await q(admin.from("games").select("*").eq("id", b.game_id).maybeSingle());
      if (!game) return { error: "game_not_found" };
      var mem = await q(admin.from("room_players").select("user_id").eq("room_id", game.room_id).eq("user_id", uid).is("left_at", null));
      if (!mem.length) return { error: "not_in_game" };
      if (game.status !== "playing") return { ok: true, state: "over", game: game };
      var rows = await q(admin.from("player_private_states").select("user_id,seat").eq("game_id", game.id));
      var uids = [];
      game.public_state.players.forEach(function (pl, p) {
        var row = rows.filter(function (r) { return r.seat === pl.seat; })[0];
        uids[p] = row ? row.user_id : null;
      });
      if (uids.some(function (u) { return !u; })) return { error: "server_error" };
      return { game: game, uids: uids };
    }

    async function forfeitPlayer(game, uids, p, reason, caller) {
      var pub = game.public_state;
      var sec = await q(admin.from("game_secrets").select("deck,disc").eq("game_id", game.id).maybeSingle());
      if (!sec) return { error: "game_not_found" };
      var last = { seq: pub.turn, p: p, n: null, id: null, t: "", before: pub.total, after: pub.total, heat: 0, fx: null, saved: false, bust: false, nx: null, forfeit: true, reason: reason };
      var npub = JSON.parse(JSON.stringify(pub));
      npub.over = p; npub.last = last; npub.log = (pub.log || []).concat([last]).slice(-8);
      var uuid = deps.uuid ? deps.uuid() : (globalThis.crypto && globalThis.crypto.randomUUID ? globalThis.crypto.randomUUID() : null);
      var res = await q(admin.rpc("nn_commit_action", {
        p_game: game.id, p_expected: game.version, p_user: caller, p_request: uuid,
        p_public: npub, p_secret: sec, p_hands: {}, p_cur: pub.cur, p_over: p,
        p_deadline: deadline(), p_action: { p: p, forfeit: true, reason: reason, by: caller }, p_type: "forfeit"
      }));
      if (res && res.error === "stale") return { ok: true, state: "stale" };
      if (res && res.error === "game_over") return { ok: true, state: "over" };
      if (res && res.error) return { error: res.error };
      return { ok: true, state: "forfeited", loser: p, reason: reason };
    }

    // ใครก็ตามในเกมเรียกได้ แต่เซิร์ฟเวอร์ตัดสินจากเวลา/heartbeat เอง (เรียกเร็วเกินไปไม่มีผล)
    async function check(uid, b) {
      var L = await loadGame(uid, b); if (L.error || L.state) return L.error ? L : { ok: true, state: "over" };
      var game = L.game, pub = game.public_state, curUid = L.uids[pub.cur];
      var hb = await q(admin.from("player_heartbeats").select("user_id,last_seen_at").eq("room_id", game.room_id).eq("user_id", curUid));
      var seen = hb.length ? Date.parse(hb[0].last_seen_at) : (Date.parse(game.updated_at || game.created_at) || 0);
      var t = now(), dl = Date.parse(game.turn_deadline_at) || 0;
      var connected = (t - seen) <= HB_FRESH_MS;
      var eff = connected ? dl : Math.max(dl, seen + RECONNECT_MS);
      if (t <= eff) return { ok: true, state: "waiting", remaining_ms: eff - t, connected: connected };
      return await forfeitPlayer(game, L.uids, pub.cur, connected ? "timeout" : "disconnected", uid);
    }

    // ผู้เล่นกดออกจากเกมกลางคัน = ยอมแพ้
    async function forfeit(uid, b) {
      var L = await loadGame(uid, b); if (L.error || L.state) return L.error ? L : { ok: true, state: "over" };
      var p = L.uids.indexOf(uid);
      if (p < 0) return { error: "not_in_game" };
      return await forfeitPlayer(L.game, L.uids, p, "left", uid);
    }

    async function handle(uid, body) {
      try {
        if (!uid || !body || typeof body !== "object") return { error: "bad_request" };
        if (body.action === "start") return await start(uid, body);
        if (body.action === "play") return await play(uid, body);
        if (body.action === "check") return await check(uid, body);
        if (body.action === "forfeit") return await forfeit(uid, body);
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


// ---------- ส่วนที่ผูกกับ Supabase/Deno ----------
const ALLOWED = (Deno.env.get("ALLOWED_ORIGINS") || "https://monogizmo.github.io").split(",").map((s) => s.trim());
const SB_URL = Deno.env.get("SUPABASE_URL");
// service_role อยู่ในสภาพแวดล้อมของ Edge Function เท่านั้น (ไม่เคยอยู่ในโค้ด/ GitHub)
const SB_KEY = Deno.env.get("SB_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const admin = createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

// ตัวสุ่มปลอดภัย 53 บิต ช่วง [0,1)
function rnd() {
  const b = new Uint32Array(2);
  crypto.getRandomValues(b);
  return (b[0] * 2097152 + (b[1] >>> 11)) / 9007199254740992;
}
const api = globalThis.NNApi.create({ admin, rnd, log: (...a) => console.error(...a) });

function corsHeaders(req) {
  const o = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED.includes(o) ? o : ALLOWED[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

Deno.serve(async (req) => {
  const h = corsHeaders(req);
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...h, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return json({ error: "bad_request" }, 405);

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "not_authenticated" }, 401);
  const { data, error } = await admin.auth.getUser(token);      // ตรวจ JWT จริง ไม่เชื่อ user id จาก body
  if (error || !data || !data.user) return json({ error: "not_authenticated" }, 401);

  let body;
  try { body = await req.json(); } catch (_) { return json({ error: "bad_request" }, 400); }
  const out = await api.handle(data.user.id, body);
  return json(out, out.error === "server_error" ? 500 : 200);
});
