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
 *
 * ดัชนีผู้เล่นใน pub ทุกช่อง (cur, shield, force, dbl.p, handCounts, last.p/nx, over, winner, out, alive) เป็น "ดัชนีเดิมตอนเริ่มเกม"
 * ซึ่งคงที่ตลอดเกม ส่วน engine ใช้ดัชนี 0..n-1 ของ "ผู้เล่นที่ยังอยู่" (pub.alive) — แปลงที่ขอบของ applyPlay/removePlayer เท่านั้น
 * โหมด one_loser: alive = ทุกคนตลอดเกม (พฤติกรรมเหมือนเดิมทุกอย่าง)
 * โหมด elimination: ใครทำกองเกิน (หรือหมดเวลา/ออก) = ตกรอบ กองรีเซ็ตเป็น 0 เล่นต่อจนเหลือ 1 คน (ผู้ชนะ)
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./nn-engine.js"));
  else root.NNServer = factory(root.NNEngine);
})(typeof self !== "undefined" ? self : this, function (NN) {
  "use strict";
  var LOG_MAX = 8;

  function copy(x) { return JSON.parse(JSON.stringify(x)); }
  function range(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); return a; }

  // สร้างสถานะสาธารณะจาก engine (G เรียงตาม alive) ; np = จำนวนผู้เล่นเดิมทั้งหมด
  function pubFrom(G, alive, np, meta) {
    var shield = [], hc = [];
    for (var o = 0; o < np; o++) { shield.push(false); hc.push(0); }
    alive.forEach(function (orig, i) { shield[orig] = !!G.shield[i]; hc[orig] = G.hands[i].length; });
    return {
      v: 2, mode: meta.mode, np: np, alive: alive.slice(), out: meta.out.slice(),
      cap: G.cap, n: G.n, two: G.two, heatAt: G.heatAt,
      total: G.total, prev: G.prev, dir: G.dir, cur: alive[G.cur], turn: G.turn, heat: G.heat(),
      seq: meta.seq, turns: meta.turns,
      shield: shield, dbl: G.dbl ? { p: alive[G.dbl.p], left: G.dbl.left } : null,
      force: G.force < 0 ? -1 : alive[G.force], over: meta.over, winner: meta.winner,
      handCounts: hc, players: meta.players, last: meta.last || null, log: meta.log || []
    };
  }

  /* เริ่มเกม: players = [{user_id, seat, name, avatar}] (2–4 คน) ; ดัชนีเดิม = ลำดับที่นั่งจากน้อยไปมาก */
  function startGame(players, cap, rnd, mode) {
    mode = mode || "one_loser";
    var ps = players.slice().sort(function (a, b) { return a.seat - b.seat; });
    var n = ps.length;
    if (n < 2 || n > 4) return { error: "bad_player_count" };
    if ([120, 150, 200].indexOf(cap) < 0) return { error: "bad_cap" };
    if (mode !== "one_loser" && mode !== "elimination") return { error: "bad_mode" };
    var G = NN.engine({ cap: cap, n: n }, rnd);
    G.deal();
    G.cur = Math.floor(rnd() * n);                       // สุ่มคนเริ่ม (ฝั่งเซิร์ฟเวอร์)
    var pl = ps.map(function (x, p) { return { p: p, seat: x.seat, name: x.name, avatar: x.avatar }; });
    var hands = {};
    ps.forEach(function (x, p) { hands[x.user_id] = G.hands[p]; });
    return {
      pub: pubFrom(G, range(n), n, { mode: mode, out: [], seq: 0, turns: 0, over: -1, winner: null, players: pl, last: null, log: [] }),
      secret: { deck: G.deck, disc: G.disc },
      hands: hands,
      uids: ps.map(function (x) { return x.user_id; }),
      cur: G.cur
    };
  }

  // สร้าง engine จากสถานะสาธารณะ + สำรับลับ + มือ (เรียงตาม pub.alive)
  function engineFrom(snap) {
    var pub = snap.pub, alive = pub.alive;
    var st = {
      cap: pub.cap, n: alive.length, two: alive.length === 2, heatAt: pub.heatAt, total: pub.total, prev: pub.prev,
      dir: pub.dir, cur: alive.indexOf(pub.cur), over: -1, turn: pub.turn,
      shield: alive.map(function (o) { return !!pub.shield[o]; }),
      dbl: pub.dbl ? { p: alive.indexOf(pub.dbl.p), left: pub.dbl.left } : null,
      force: pub.force < 0 ? -1 : alive.indexOf(pub.force),
      deck: snap.secret.deck, disc: snap.secret.disc,
      hands: alive.map(function (o) { return snap.hands[snap.uids[o]]; })
    };
    return st;
  }

  // เอาผู้เล่นออกจากสถานะ engine (st = engine state ตามลำดับ alive เดิม)  resetPile = กองรีเซ็ตเป็น 0 (กรณีทำกองเกิน)
  function removeFromState(st, idx, resetPile) {
    var s = copy(st), nOld = s.n, wasCur = s.cur === idx;
    s.disc = s.disc.concat(s.hands[idx]);
    s.hands.splice(idx, 1); s.shield.splice(idx, 1);
    s.n = nOld - 1; s.two = s.n === 2;
    if (wasCur) s.cur = s.dir === 1 ? idx % s.n : (idx - 1 + s.n) % s.n;
    else if (s.cur > idx) s.cur -= 1;
    if (s.force === idx) s.force = -1; else if (s.force > idx) s.force -= 1;
    if (s.dbl) { if (s.dbl.p === idx) s.dbl = null; else if (s.dbl.p > idx) s.dbl.p -= 1; }
    s.over = -1;
    if (resetPile) { s.total = 0; s.prev = 0; s.turn = 0; s.dbl = null; s.force = -1; }
    return s;
  }

  /* ผู้เล่น orig ตกรอบ/แพ้ ด้วยเหตุผล (bust | timeout | disconnected | left)
   * ใช้ทั้งตอนลงไพ่แล้วเกิน (afterPlay=true: state ผ่านการลงแล้ว) และตอนยอมแพ้ (afterPlay=false)
   * คืน { pub, secret, hands(เฉพาะที่เปลี่ยน), cur, over, elim } */
  function eliminate(snap, G, orig, meta, resetPile, rnd) {
    var pub = snap.pub, alive = pub.alive, np = pub.np;
    var idx = alive.indexOf(orig);
    var st = G ? NN.exportState(G) : engineFrom(snap);
    var out = pub.out.concat([orig]);
    var changed = {};
    if (pub.mode === "elimination" && alive.length > 2) {
      var s2 = removeFromState(st, idx, resetPile);
      var alive2 = alive.filter(function (o) { return o !== orig; });
      var G2 = NN.importState(s2, rnd);
      var np2 = pubFrom(G2, alive2, np, {
        mode: pub.mode, out: out, seq: meta.seq, turns: meta.turns, over: -1, winner: null,
        players: pub.players, last: meta.last, log: meta.log
      });
      alive.forEach(function (o, i) {                    // มือของคนที่ยังอยู่ (อาจเปลี่ยนจากการลงไพ่) + ล้างมือคนตกรอบ
        var uid = snap.uids[o];
        var nh = o === orig ? [] : G2.hands[alive2.indexOf(o)];
        if (JSON.stringify(snap.hands[uid]) !== JSON.stringify(nh)) changed[uid] = nh;
      });
      return { pub: np2, secret: { deck: G2.deck, disc: G2.disc }, hands: changed, cur: np2.cur, over: -1, elim: orig };
    }
    // จบเกม: โหมดเดี่ยว = ผู้แพ้ 1 คน ; โหมดคัดออกเหลือ 2 คน = อีกคนชนะ
    var GE = G || NN.importState(st, rnd);
    var winner = null;
    if (pub.mode === "elimination") winner = alive.filter(function (o) { return o !== orig; })[0];
    var np3 = pubFrom(GE, alive, np, {
      mode: pub.mode, out: out, seq: meta.seq, turns: meta.turns, over: orig, winner: winner,
      players: pub.players, last: meta.last, log: meta.log
    });
    alive.forEach(function (o, i) {
      var uid = snap.uids[o];
      if (JSON.stringify(snap.hands[uid]) !== JSON.stringify(GE.hands[i])) changed[uid] = GE.hands[i];
    });
    return { pub: np3, secret: { deck: GE.deck, disc: GE.disc }, hands: changed, cur: np3.cur, over: orig, elim: orig };
  }

  /* ลงไพ่ 1 ใบ
   * snap = { pub, secret:{deck,disc}, hands:{uid:[card]}, uids:[uid ตามดัชนีเดิม] }
   * คืน { error } หรือ { pub, secret, hands(เฉพาะที่เปลี่ยน), cur, over, action } */
  function applyPlay(snap, uid, cardId, rnd) {
    var pub = snap.pub;
    if (!pub || pub.over >= 0) return { error: "game_over" };
    var orig = snap.uids.indexOf(uid);
    if (orig < 0) return { error: "not_in_game" };
    if (pub.alive.indexOf(orig) < 0) return { error: "eliminated" };
    if (pub.cur !== orig) return { error: "not_your_turn" };
    var mine = snap.hands[uid] || [];
    var i = -1;
    for (var k = 0; k < mine.length; k++) if (mine[k].id === cardId) { i = k; break; }
    if (i < 0) return { error: "card_not_in_hand" };

    var alive = pub.alive, p = alive.indexOf(orig);
    var G = NN.importState(engineFrom(snap), rnd);
    if (G.legal(p).indexOf(i) < 0) return { error: "illegal_card" };

    var r = G.play(p, i, 0);
    var last = {
      seq: pub.seq, p: orig, n: r.c.n, id: r.c.id, t: r.o.t, before: r.before, after: r.after,
      heat: r.heat, fx: r.fx, saved: r.saved, bust: r.bust, nx: (r.nx != null && r.nx >= 0) ? alive[r.nx] : r.nx
    };
    var log = (pub.log || []).concat([last]).slice(-LOG_MAX);
    var meta = { mode: pub.mode, out: pub.out, seq: pub.seq + 1, turns: pub.turns + 1, over: -1, winner: null, players: pub.players, last: last, log: log };

    var res;
    if (r.bust) {
      last.elim = orig;
      res = eliminate(snap, G, orig, meta, true, rnd);
    } else {
      var npub = pubFrom(G, alive, pub.np, meta);
      var changed = {};
      alive.forEach(function (o, q) {
        var u = snap.uids[o];
        if (JSON.stringify(snap.hands[u]) !== JSON.stringify(G.hands[q])) changed[u] = G.hands[q];
      });
      res = { pub: npub, secret: { deck: G.deck, disc: G.disc }, hands: changed, cur: npub.cur, over: -1, elim: null };
    }
    res.action = { p: orig, card_id: cardId, last: last };
    return res;
  }

  /* ยอมแพ้ (หมดเวลา/หลุด/ออก) = ตกรอบ ; ถ้าเป็นโหมดเดี่ยวหรือเหลือ 2 คน = เกมจบ */
  function applyForfeit(snap, orig, reason, rnd) {
    var pub = snap.pub;
    if (!pub || pub.over >= 0) return { error: "game_over" };
    if (pub.alive.indexOf(orig) < 0) return { error: "eliminated" };
    var last = { seq: pub.seq, p: orig, n: null, id: null, t: "", before: pub.total, after: pub.total, heat: 0, fx: null, saved: false, bust: false, nx: null, forfeit: true, reason: reason, elim: orig };
    var log = (pub.log || []).concat([last]).slice(-LOG_MAX);
    var meta = { mode: pub.mode, out: pub.out, seq: pub.seq + 1, turns: pub.turns, over: -1, winner: null, players: pub.players, last: last, log: log };
    var res = eliminate(snap, null, orig, meta, false, rnd);
    res.action = { p: orig, forfeit: true, reason: reason, last: last };
    return res;
  }

  /* สถิติท้ายเกม (สาธารณะ) */
  function summary(pub) {
    return { loser: pub.over, winner: pub.winner, turns: pub.turns, total: pub.last ? pub.last.after : pub.total, cap: pub.cap, out: pub.out };
  }

  return { startGame: startGame, applyPlay: applyPlay, applyForfeit: applyForfeit, summary: summary, copy: copy };
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
      var ps = await q(admin.from("room_players").select("*").eq("room_id", room.id).is("left_at", null).order("seat"));
      if (ps.length < 2 || ps.length > 4) return { error: "bad_player_count" };
      if (ps.some(function (p) { return !p.is_ready; })) return { error: "not_all_ready" };

      var g = SV.startGame(ps.map(function (p) {
        return { user_id: p.user_id, seat: p.seat, name: p.player_name, avatar: p.avatar };
      }), room.cap, rnd, room.mode);
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
      var rows = await q(admin.from("player_private_states").select("user_id,seat,hand").eq("game_id", game.id));
      var uids = [], hands = {};
      game.public_state.players.forEach(function (pl, p) {
        var row = rows.filter(function (r) { return r.seat === pl.seat; })[0];
        uids[p] = row ? row.user_id : null;
      });
      if (uids.some(function (u) { return !u; })) return { error: "server_error" };
      rows.forEach(function (r) { hands[r.user_id] = r.hand; });
      return { game: game, uids: uids, hands: hands };
    }

    // ผู้เล่น orig ยอมแพ้: โหมดเดี่ยว/เหลือ 2 คน = เกมจบ ; โหมดคัดออก = ตกรอบแล้วเล่นต่อ
    async function forfeitPlayer(L, orig, reason, caller) {
      var game = L.game;
      var sec = await q(admin.from("game_secrets").select("deck,disc").eq("game_id", game.id).maybeSingle());
      if (!sec) return { error: "game_not_found" };
      var out = SV.applyForfeit({ pub: game.public_state, secret: sec, hands: L.hands, uids: L.uids }, orig, reason, rnd);
      if (out.error === "eliminated") return { ok: true, state: "out" };
      if (out.error) return { error: out.error };
      var uuid = deps.uuid ? deps.uuid() : (globalThis.crypto && globalThis.crypto.randomUUID ? globalThis.crypto.randomUUID() : null);
      var res = await q(admin.rpc("nn_commit_action", {
        p_game: game.id, p_expected: game.version, p_user: caller, p_request: uuid,
        p_public: out.pub, p_secret: out.secret, p_hands: out.hands, p_cur: out.cur, p_over: out.over,
        p_deadline: deadline(), p_action: out.action, p_type: "forfeit"
      }));
      if (res && res.error === "stale") return { ok: true, state: "stale" };
      if (res && res.error === "game_over") return { ok: true, state: "over" };
      if (res && res.error) return { error: res.error };
      return { ok: true, state: out.over >= 0 ? "forfeited" : "eliminated", loser: orig, reason: reason, over: out.over >= 0 };
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
      return await forfeitPlayer(L, pub.cur, connected ? "timeout" : "disconnected", uid);
    }

    // ผู้เล่นกดออกจากเกมกลางคัน = ยอมแพ้
    async function forfeit(uid, b) {
      var L = await loadGame(uid, b); if (L.error || L.state) return L.error ? L : { ok: true, state: "over" };
      var p = L.uids.indexOf(uid);
      if (p < 0) return { error: "not_in_game" };
      return await forfeitPlayer(L, p, "left", uid);
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
