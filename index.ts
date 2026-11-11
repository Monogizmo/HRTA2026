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
     var G={cap:o.cap,n:o.n,two:o.n===2,hands:[],deck:[],disc:[],total:0,prev:0,dir:1,cur:0,over:-1,turn:0,band:9,shield:[],force:-1,heatAt:Math.round(o.cap/6),dbl:null,seal:[],owe:[],calm:[],rev:[],seq:null,pend:null,hb:0};
     G.heat=function(){return(G.turn>=G.heatAt?1+Math.floor((G.turn-G.heatAt)/6):0)+(G.hb||0)};
     var shuf=function(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(rnd()*(i+1)),t=a[i];a[i]=a[j];a[j]=t}return a};
     var scr=function(t){return Math.floor(t/100)*100+(t%10)*10+Math.floor((t%100)/10)};
     G.deal=function(){var d=[];for(var k=0;k<2;k++)for(var n=0;n<22;n++)d.push({n:n,id:k*22+n});G.deck=shuf(d);G.disc=[];G.hands=[];G.shield=[];G.seal=[];G.owe=[];G.calm=[];G.rev=[];for(var p=0;p<G.n;p++){G.hands.push(G.deck.splice(0,3));G.shield.push(false);G.seal.push(false);G.owe.push(false);G.calm.push(0);G.rev.push(false)}};
     G.draw=function(p){if(!G.deck.length)G.deck=shuf(G.disc.splice(0));if(G.deck.length)G.hands[p].push(G.deck.shift())};
     G.low=function(p){var h=G.hands[p],m=0;h.forEach(function(c,i){if(c.n<h[m].n)m=i});return m};
     G.dump=function(p){var h=G.hands[p];if(!h.length)return;var m=0;h.forEach(function(c,i){if(c.n>h[m].n)m=i});G.disc.push(h.splice(m,1)[0]);G.draw(p)};
     G.dumpLow=function(p){var h=G.hands[p];if(!h.length)return;G.disc.push(h.splice(G.low(p),1)[0]);G.draw(p)};
     G.next=function(p){return((p+G.dir)%G.n+G.n)%G.n};
     G.legal=function(p){var h=G.hands[p],ix=[],mx=-1;h.forEach(function(c){if(c.n>mx)mx=c.n});h.forEach(function(c,i){if(G.force!==p||c.n===mx)ix.push(i)});return ix};
     G.targets=function(p){var a=[];for(var q=0;q<G.n;q++)if(q!==p)a.push(q);return a};
     G.needsTarget=function(fx){return fx==="fool"||fx==="seal"};
     /* พลังไพ่ (ใช้เหมือนกันทุกจำนวนผู้เล่น) */
     G.opts=function(n){var c=G.cap,t=G.total,hf=t+Math.ceil((c-t)/2);switch(n){
      case 0:return[{t:"+0 สลับมือ",v:0,fx:"fool"}];
      case 1:return[{t:"+1 เสกไพ่ปีศาจ",v:1,fx:"conj"}];
      case 2:return[{t:"ปั่นเลข +2 → "+(scr(t)+2),set:scr(t)+2}];
      case 3:return[{t:"+3",v:3}];
      case 4:return[{t:"+4 ผนึกพลัง",v:4,fx:"seal"}];
      case 5:return[{t:"+5 ริบไพ่ต่ำสุด",v:5,fx:"rob"}];
      case 6:return[{t:"+6 บังคับใบสูงสุด",v:6,fx:"force"}];
      case 7:return[{t:"+7 ลงเพิ่มได้ 1 ใบ",v:7,fx:"chariot"}];
      case 8:return[{t:"คูณสอง → "+t*2,set:t*2}];
      case 9:return[{t:"+9 รับโล่",v:9,fx:"shield"}];
      case 10:return[{t:"ปั่นวงล้อ −15…+25",v:0,fx:"wheel"}];
      case 11:return[{t:"เฉือนครึ่ง → "+Math.floor(t/2),set:Math.floor(t/2)}];
      case 12:return[{t:"กลับกอง → "+Math.max(0,c-t),set:Math.max(0,c-t)}];
      case 13:return[{t:"ย้อนเวลา → "+G.prev,set:G.prev}];
      case 14:return[{t:"ดันครึ่งทาง → "+hf+" ย้อนทิศ",set:hf,fx:"rev"}];
      case 15:return[{t:"+15 คนต่อไปลง 2",v:15,fx:"devil"}];
      case 16:return[{t:"ล้างกอง → 0",set:0}];
      case 17:return[{t:"−17 → "+Math.max(0,t-17),v:-17,fx:"star"},{t:"+17 → "+(t+17),v:17,fx:"star"}];
      case 18:return[{t:"+"+(t%10)+" เปลี่ยนไพ่ในมือ",v:t%10,fx:"moon"}];
      case 19:return[{t:"+19 เพดาน +19 🔥+1",v:19,fx:"sun"}];
      case 20:return[{t:"+20 ทุกคนล้างไพ่",v:20,fx:"all"}];
      case 21:return[{t:"ดันเป็น "+c,set:c,fx:"world"}];
      default:return[{t:"+"+n,v:n}]}};
     /* คำนวณผลของไพ่ 1 ใบ (ไฟลามทุ่ง โล่ ฯลฯ) — ใช้ร่วมกันทั้งการลงปกติและการแทรก */
     var calc=function(p,c,k,sealed){
      var o=sealed?{t:"+"+c.n,v:c.n}:G.opts(c.n)[k||0],b=G.total,fx=o.fx||"";
      var t=o.set!=null?o.set:Math.max(0,b+o.v);if(fx==="wheel")t=Math.max(0,b+Math.floor(rnd()*41)-15);
      var hh=G.heat();if(fx==="star"&&hh>0)G.calm[p]=2;if(fx==="world"||fx==="sun")hh=0;if(fx==="sun")G.cap+=19;if(G.calm[p]>0){hh=0;G.calm[p]--}
      t+=hh;var saved=false;
      if(t>G.cap&&G.shield[p]){G.shield[p]=false;saved=true;t=Math.max(0,G.cap-15)}
      return{o:o,b:b,fx:fx,t:t,hh:hh,saved:saved}};
     var pickTg=function(p,tg){var a=G.targets(p);return a.indexOf(tg)>=0?tg:(a.length===1?a[0]:G.next(p))};
     /* ลงไพ่ 1 ใบ (tg = เป้าหมายของ Fool/Emperor/Moon) — ถ้ายังต้องรับคำสั่งต่อ (ลงใบที่ 2 / ลงเพิ่ม / เลือก Sun) จะตั้ง G.pend */
     G.play=function(p,i,k,tg){if(G.force===p)G.force=-1;
      var S=(G.seq&&G.seq.p===p)?G.seq:(G.seq={p:p,plays:0,max:1,forced:!!(G.dbl&&G.dbl.p===p),opt:false,sun:false,moon:false,owed:0,post:[]});
      var c=G.hands[p].splice(i,1)[0],sealed=!!G.seal[p];G.seal[p]=false;
      var m=calc(p,c,k,sealed),o=m.o,fx=m.fx,nx=G.next(p);
      G.total=m.t;G.prev=m.b;G.disc.push(c);G.turn++;
      var r={heat:m.hh,p:p,c:c,o:o,before:m.b,after:m.t,fx:fx,nx:nx,saved:m.saved,bust:m.t>G.cap,sealed:sealed,tg:null,pend:null};
      if(r.bust){G.over=p;G.seq=null;G.pend=null;return r}
      S.plays++;S.owed++;
      if(fx==="shield")G.shield[p]=true;
      if(fx==="rev")G.dir=-G.dir;
      if(fx==="all")for(var q=0;q<G.n;q++)G.dump(q);
      if(fx==="rob")G.dumpLow(nx);
      if(fx==="force")G.force=nx;
      if(fx==="conj"){var h2=G.hands[nx],mm=G.low(nx);G.disc.push(h2[mm]);h2[mm]={n:15,id:900+G.turn}}
      if(G.needsTarget(fx)){tg=pickTg(p,tg);r.tg=tg;
       if(fx==="fool")S.post.push({fx:"swap",a:p,b:tg});
       if(fx==="seal")G.seal[tg]=true;
       }
      if(fx==="devil")S.post.push({fx:"devil",q:nx});
      if(fx==="sun")G.hb++;if(fx==="moon")S.moon=true;
      if(fx==="chariot"&&!S.forced&&S.plays===1){S.opt=true;S.max=2}
      if(S.forced&&S.plays<2){G.pend={t:"forced",p:p};r.pend="forced";return r}
      if(S.opt&&S.plays<2){G.pend={t:"extra",p:p};r.pend="extra";return r}
      return G.finish(p,r)};
     /* จบการลงไพ่ของตา: จั่วคืนตามจำนวนที่ลง (Moon: หลังจั่วคืน รอผู้ลงเลือกทิ้งไพ่ในมือแล้วจั่วใหม่) */
     G.finish=function(p,r){return G.end(p,r)};
     G.pass=function(p){var pd=G.pend;if(!pd||pd.t!=="extra"||pd.p!==p)return null;G.pend=null;return G.end(p,{pass:true,p:p,pend:null})};
     G.end=function(p,r){var S=G.seq;
      for(var j=0;j<S.owed;j++)G.draw(p);S.owed=0;
      if(S.moon){S.moon=false;if(G.hands[p].length){G.pend={t:"moon",p:p};r.pend="moon";return r}}
      return G.fin(p,r)};
     /* The Moon: ทิ้งไพ่ในมือกี่ใบก็ได้ (ix = ดัชนีในมือ) แล้วจั่วใหม่เท่าจำนวนที่ทิ้ง — จั่วก่อนแล้วค่อยทิ้ง จึงไม่ได้ใบที่เพิ่งทิ้งกลับมา */
     G.swap=function(p,ix){var pd=G.pend;if(!pd||pd.t!=="moon"||pd.p!==p)return null;
      var h=G.hands[p],u=[];(ix||[]).forEach(function(i){if(Number.isInteger(i)&&i>=0&&i<h.length&&u.indexOf(i)<0)u.push(i)});
      var nw=[];for(var j=0;j<u.length;j++){if(!G.deck.length)G.deck=shuf(G.disc.splice(0));if(G.deck.length)nw.push(G.deck.shift())}
      u=u.slice(0,nw.length).sort(function(a,b){return b-a});
      u.forEach(function(i){G.disc.push(h.splice(i,1)[0])});nw.forEach(function(c){h.push(c)});
      G.pend=null;return G.fin(p,{swap:true,p:p,k:u.length,pend:null})};
     G.fin=function(p,r){var S=G.seq;
      if(S.forced&&G.dbl&&G.dbl.p===p)G.dbl=null;
      S.post.forEach(function(e){if(e.fx==="swap"){var t=G.hands[e.a];G.hands[e.a]=G.hands[e.b];G.hands[e.b]=t}else if(e.fx==="devil")G.dbl={p:e.q,left:2}});
      G.rev[p]=false;G.seq=null;G.pend=null;G.adv(p);return r};
     G.adv=function(p){G.cur=G.next(p);var g=0;while(G.owe[G.cur]&&g++<G.n){G.draw(G.cur);G.owe[G.cur]=false;G.cur=G.next(G.cur)}};
     /* The Empress แทรกเทิร์น: ใช้ได้ตอนไม่ใช่ตาตัวเอง (และยังไม่มีใครเริ่มลงในตานี้) — ไม่จั่วทันที ตาปกติถัดไปของผู้แทรกไม่ลง แค่จั่ว 1 ใบ */
     G.canInterject=function(p){if(G.over>=0||G.pend||G.seq||p===G.cur||G.owe[p]||G.seal[p]||(G.dbl&&G.dbl.p===p))return-1;
      var h=G.hands[p],ix=G.legal(p);for(var a=0;a<ix.length;a++)if(h[ix[a]].n===3)return ix[a];return-1};
     G.interject=function(p){var i=G.canInterject(p);if(i<0)return null;if(G.force===p)G.force=-1;
      var c=G.hands[p].splice(i,1)[0],m=calc(p,c,0,false);
      G.total=m.t;G.prev=m.b;G.disc.push(c);G.turn++;
      var r={interject:true,heat:m.hh,p:p,c:c,o:m.o,before:m.b,after:m.t,fx:"",nx:G.next(p),saved:m.saved,bust:m.t>G.cap,sealed:false,tg:null,pend:null};
      if(r.bust){G.over=p;return r}
      G.owe[p]=true;return r};
     /* AI */
     G.aiBest=function(p){var best=null,bs=-1e9,hh=G.heat(),cm=G.calm[p]>0?0:hh;
      G.legal(p).forEach(function(i){var c=G.hands[p][i],os=G.seal[p]?[{t:"+"+c.n,v:c.n}]:G.opts(c.n);
       os.forEach(function(o,k){var w=o.fx==="wheel",h2=(o.fx==="world"||o.fx==="sun")?0:cm,t=(o.set!=null?o.set:w?G.total+5:Math.max(0,G.total+o.v))+h2,s;
        if(t>(o.fx==="sun"?G.cap+19:G.cap)){s=G.shield[p]?G.cap-15-30+rnd()*4:-1000-(t-G.cap)}
        else{s=t+rnd()*7;if(o.fx==="sun")s-=19;if(RES.indexOf(c.n)>=0&&t<G.cap-25)s-=16;if(w&&G.total+25+h2>G.cap)s-=40}
        if(s>bs){bs=s;best={i:i,k:k,t:t,tg:G.needsTarget(o.fx)?(o.fx==="fool"?G.targets(p)[Math.floor(rnd()*(G.n-1))]:G.next(p)):null}}})});return best};
     G.aiStep=function(p){var pd=G.pend;
      if(pd&&pd.p===p&&pd.t==="moon"){var dx=[];G.hands[p].forEach(function(c,i){if([15,17,18,19,20].indexOf(c.n)>=0)dx.push(i)});return{t:"swap",ix:dx}}
      var b=G.aiBest(p);
      if(pd&&pd.p===p&&pd.t==="extra"&&!(b&&b.t<G.total))return{t:"pass"};
      return{t:"play",i:b.i,k:b.k,tg:b.tg}};
     G.aiInterject=function(p){return G.canInterject(p)>=0&&G.total+3+G.heat()<G.cap-25&&rnd()<.35};
     return G}

  /* ---- ส่วนเสริม (ไม่อยู่ใน engine เดิม): แปลง state เป็น JSON เพื่อเก็บใน DB ---- */
  var KEYS = ["cap", "n", "two", "hands", "deck", "disc", "total", "prev", "dir", "cur", "over", "turn", "shield", "dbl", "force", "heatAt", "seal", "owe", "calm", "rev", "seq", "pend", "hb"];
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
 * ข้อมูลแบ่ง 3 ชั้น:  pub = สาธารณะ (ทุกคนในห้องเห็น) · hands/extras = ของผู้เล่นแต่ละคน (เห็นเฉพาะเจ้าของ) · secret = สำรับ/กองทิ้ง/ไพ่ที่รอเลือก (ไม่มีใครเห็น)
 *
 * ดัชนีผู้เล่นใน pub ทุกช่อง เป็น "ดัชนีเดิมตอนเริ่มเกม" ซึ่งคงที่ตลอดเกม ส่วน engine ใช้ดัชนี 0..n-1 ของ "ผู้เล่นที่ยังอยู่" (pub.alive)
 * แปลงที่ขอบของ pubFrom/engineFrom เท่านั้น
 * action ที่รองรับ: play (card_id, k, tg) · pass (ข้ามการลงเพิ่มของ Chariot) · swap (เลือกไพ่ที่จะทิ้งของ Moon) · interject (Empress แทรกเทิร์น) · forfeit
 * โหมด one_loser: alive = ทุกคนตลอดเกม · โหมด elimination: ตกรอบแล้วกองรีเซ็ตเป็น 0 เล่นต่อจนเหลือ 1 คน
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./nn-engine.js"));
  else root.NNServer = factory(root.NNEngine);
})(typeof self !== "undefined" ? self : this, function (NN) {
  "use strict";
  var LOG_MAX = 8;

  function copy(x) { return JSON.parse(JSON.stringify(x)); }
  function range(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); return a; }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  // สร้างสถานะสาธารณะจาก engine (G เรียงตาม alive) ; np = จำนวนผู้เล่นเดิมทั้งหมด
  function pubFrom(G, alive, np, meta) {
    var shield = [], seal = [], owe = [], calm = [], hc = [];
    for (var o = 0; o < np; o++) { shield.push(false); seal.push(false); owe.push(false); calm.push(0); hc.push(0); }
    var rev = [];
    alive.forEach(function (orig, i) {
      shield[orig] = !!G.shield[i]; seal[orig] = !!G.seal[i]; owe[orig] = !!G.owe[i]; calm[orig] = G.calm[i] || 0; hc[orig] = G.hands[i].length;
      if (G.rev[i]) rev.push({ p: orig, hand: G.hands[i] });
    });
    var seq = null;
    if (G.seq) {
      seq = { p: alive[G.seq.p], plays: G.seq.plays, max: G.seq.max, forced: G.seq.forced, opt: G.seq.opt, sun: G.seq.sun, moon: !!G.seq.moon, owed: G.seq.owed,
        post: G.seq.post.map(function (e) { return e.fx === "swap" ? { fx: "swap", a: alive[e.a], b: alive[e.b] } : { fx: "devil", q: alive[e.q] }; }) };
    }
    return {
      v: 3, mode: meta.mode, np: np, alive: alive.slice(), out: meta.out.slice(),
      cap: G.cap, n: G.n, heatAt: G.heatAt, hb: G.hb || 0,
      total: G.total, prev: G.prev, dir: G.dir, cur: alive[G.cur], turn: G.turn, heat: G.heat(),
      seq_n: meta.seq, turns: meta.turns,
      shield: shield, seal: seal, owe: owe, calm: calm, rev: rev, seq: seq,
      pend: G.pend ? { t: G.pend.t, p: alive[G.pend.p] } : null,
      dbl: G.dbl ? { p: alive[G.dbl.p], left: G.dbl.left } : null,
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
      secret: { deck: G.deck, disc: G.disc, pend: null },
      hands: hands,
      uids: ps.map(function (x) { return x.user_id; }),
      cur: G.cur
    };
  }

  // สร้างสถานะ engine จากสถานะสาธารณะ + สำรับลับ + มือ (เรียงตาม pub.alive)
  function engineFrom(snap) {
    var pub = snap.pub, alive = pub.alive, inv = function (o) { return alive.indexOf(o); };
    var pick = function (arr) { return alive.map(function (o) { return arr[o]; }); };
    var rev = alive.map(function (o) { return (pub.rev || []).some(function (r) { return r.p === o; }); });
    var st = {
      cap: pub.cap, n: alive.length, two: alive.length === 2, heatAt: pub.heatAt, hb: pub.hb || 0, total: pub.total, prev: pub.prev,
      dir: pub.dir, cur: inv(pub.cur), over: -1, turn: pub.turn,
      shield: pick(pub.shield).map(Boolean), seal: pick(pub.seal).map(Boolean), owe: pick(pub.owe).map(Boolean), calm: pick(pub.calm).map(function (x) { return x || 0; }), rev: rev,
      dbl: pub.dbl ? { p: inv(pub.dbl.p), left: pub.dbl.left } : null,
      force: pub.force < 0 ? -1 : inv(pub.force),
      seq: null, pend: null,
      deck: snap.secret.deck, disc: snap.secret.disc,
      hands: alive.map(function (o) { return snap.hands[snap.uids[o]]; })
    };
    if (pub.seq) {
      st.seq = { p: inv(pub.seq.p), plays: pub.seq.plays, max: pub.seq.max, forced: pub.seq.forced, opt: pub.seq.opt, sun: pub.seq.sun, moon: !!pub.seq.moon, owed: pub.seq.owed,
        post: pub.seq.post.map(function (e) { return e.fx === "swap" ? { fx: "swap", a: inv(e.a), b: inv(e.b) } : { fx: "devil", q: inv(e.q) }; }) };
    }
    if (pub.pend) {
      st.pend = { t: pub.pend.t, p: inv(pub.pend.p) };
      if (pub.pend.t === "pick") st.pend.cards = (snap.secret.pend || []).slice();
    }
    return st;
  }

  // เอาผู้เล่นออกจากสถานะ engine (st เรียงตาม alive เดิม)  resetPile = กองรีเซ็ตเป็น 0 (กรณีทำกองเกิน)
  function removeFromState(st, idx, resetPile) {
    var s = copy(st), nOld = s.n, wasCur = s.cur === idx;
    if (s.pend && s.pend.cards) s.deck = s.deck.concat(s.pend.cards);          // ไพ่ที่รอเลือกกลับไปใต้กอง
    s.disc = s.disc.concat(s.hands[idx]);
    ["hands", "shield", "seal", "owe", "calm", "rev"].forEach(function (k) { s[k].splice(idx, 1); });
    s.n = nOld - 1; s.two = s.n === 2;
    if (wasCur) s.cur = s.dir === 1 ? idx % s.n : (idx - 1 + s.n) % s.n;
    else if (s.cur > idx) s.cur -= 1;
    if (s.force === idx) s.force = -1; else if (s.force > idx) s.force -= 1;
    if (s.dbl) { if (s.dbl.p === idx) s.dbl = null; else if (s.dbl.p > idx) s.dbl.p -= 1; }
    s.seq = null; s.pend = null; s.over = -1;                                   // ตาที่ค้างอยู่ถูกยกเลิก
    if (resetPile) { s.total = 0; s.prev = 0; s.turn = 0; s.dbl = null; s.force = -1; }
    return s;
  }

  /* ผู้เล่น orig ตกรอบ/แพ้ ด้วยเหตุผล (bust | timeout | disconnected | left)
   * ใช้ทั้งตอนลงไพ่แล้วเกิน (G = engine หลังลง) และตอนยอมแพ้ (G = null)
   * คืน { pub, secret, hands(เฉพาะที่เปลี่ยน), extras, cur, over, elim } */
  function eliminate(snap, G, orig, meta, resetPile, rnd) {
    var pub = snap.pub, alive = pub.alive, np = pub.np;
    var idx = alive.indexOf(orig);
    var st = G ? NN.exportState(G) : engineFrom(snap);
    var out = pub.out.concat([orig]);
    var changed = {}, extras = {};
    if (snap.extras) alive.forEach(function (o) { var u = snap.uids[o]; if (snap.extras[u]) extras[u] = null; });   // ล้างไพ่ที่รอเลือกเดิม
    if (pub.mode === "elimination" && alive.length > 2) {
      var s2 = removeFromState(st, idx, resetPile);
      var alive2 = alive.filter(function (o) { return o !== orig; });
      var G2 = NN.importState(s2, rnd);
      var np2 = pubFrom(G2, alive2, np, {
        mode: pub.mode, out: out, seq: meta.seq, turns: meta.turns, over: -1, winner: null,
        players: pub.players, last: meta.last, log: meta.log
      });
      alive.forEach(function (o) {
        var uid = snap.uids[o];
        var nh = o === orig ? [] : G2.hands[alive2.indexOf(o)];
        if (!same(snap.hands[uid], nh)) changed[uid] = nh;
      });
      return { pub: np2, secret: { deck: G2.deck, disc: G2.disc, pend: null }, hands: changed, extras: extras, cur: np2.cur, over: -1, elim: orig };
    }
    // จบเกม: โหมดเดี่ยว = ผู้แพ้ 1 คน ; โหมดคัดออกเหลือ 2 คน = อีกคนชนะ
    var GE = G || NN.importState(st, rnd);
    if (!G && GE.pend && GE.pend.cards) { GE.deck = GE.deck.concat(GE.pend.cards); }
    GE.seq = null; GE.pend = null;
    var winner = null;
    if (pub.mode === "elimination") winner = alive.filter(function (o) { return o !== orig; })[0];
    var np3 = pubFrom(GE, alive, np, {
      mode: pub.mode, out: out, seq: meta.seq, turns: meta.turns, over: orig, winner: winner,
      players: pub.players, last: meta.last, log: meta.log
    });
    alive.forEach(function (o, i) {
      var uid = snap.uids[o];
      if (!same(snap.hands[uid], GE.hands[i])) changed[uid] = GE.hands[i];
    });
    return { pub: np3, secret: { deck: GE.deck, disc: GE.disc, pend: null }, hands: changed, extras: extras, cur: np3.cur, over: orig, elim: orig };
  }

  // ผลหลังเรียก engine (ลง/ข้าม/เลือก/แทรก) ที่ไม่ใช่การแพ้ → สร้างผลลัพธ์ทั้งหมด
  function finish(snap, G, last, kind) {
    var pub = snap.pub, alive = pub.alive;
    var log = (pub.log || []).concat([last]).slice(-LOG_MAX);
    var meta = { mode: pub.mode, out: pub.out, seq: pub.seq_n + 1, turns: pub.turns + (kind === "play" || kind === "interject" ? 1 : 0), over: -1, winner: null, players: pub.players, last: last, log: log };
    var npub = pubFrom(G, alive, pub.np, meta);
    var changed = {}, extras = {};
    alive.forEach(function (o, q) {
      var u = snap.uids[o];
      if (!same(snap.hands[u], G.hands[q])) changed[u] = G.hands[q];
      var had = snap.extras && snap.extras[u];
      var want = (G.pend && G.pend.t === "pick" && G.pend.p === q) ? { pick: G.pend.cards } : null;
      if (want) extras[u] = want; else if (had) extras[u] = null;
    });
    return { pub: npub, secret: { deck: G.deck, disc: G.disc, pend: G.pend && G.pend.cards ? G.pend.cards : null }, hands: changed, extras: extras, cur: npub.cur, over: -1, elim: null, meta: meta };
  }
  function bustResult(snap, G, orig, last, kind, rnd) {
    var pub = snap.pub, log = (pub.log || []).concat([last]).slice(-LOG_MAX);
    last.elim = orig;
    var meta = { mode: pub.mode, out: pub.out, seq: pub.seq_n + 1, turns: pub.turns + 1, over: -1, winner: null, players: pub.players, last: last, log: log };
    return eliminate(snap, G, orig, meta, true, rnd);
  }
  function lastFrom(pub, orig, r, alive, kind) {
    return {
      seq: pub.seq_n, kind: kind, p: orig, n: r.c.n, id: r.c.id, t: r.o.t, before: r.before, after: r.after,
      heat: r.heat, fx: r.fx, saved: r.saved, bust: r.bust, sealed: !!r.sealed,
      nx: (r.nx != null && r.nx >= 0) ? alive[r.nx] : r.nx, tg: (r.tg != null && r.tg >= 0) ? alive[r.tg] : null
    };
  }

  // ตรวจว่าใครเป็นผู้ลงได้: ถ้ามี pend → คนใน pend ; ไม่งั้น cur
  function actor(pub) { return pub.pend ? pub.pend.p : pub.cur; }
  function baseCheck(snap, uid) {
    var pub = snap.pub;
    if (!pub || pub.over >= 0) return { error: "game_over" };
    var orig = snap.uids.indexOf(uid);
    if (orig < 0) return { error: "not_in_game" };
    if (pub.alive.indexOf(orig) < 0) return { error: "eliminated" };
    return { orig: orig };
  }

  /* ลงไพ่ 1 ใบ  opt = { k, tg }  (tg เป็นดัชนีเดิมของผู้เล่นเป้าหมายสำหรับ Fool/Emperor/Moon) */
  function applyPlay(snap, uid, cardId, rnd, opt) {
    opt = opt || {};
    var c0 = baseCheck(snap, uid); if (c0.error) return c0;
    var pub = snap.pub, orig = c0.orig, alive = pub.alive;
    if (pub.pend && pub.pend.t === "moon") return { error: pub.pend.p === orig ? "must_swap" : "not_your_turn" };
    if (actor(pub) !== orig) return { error: "not_your_turn" };
    var mine = snap.hands[uid] || [];
    var i = -1;
    for (var k = 0; k < mine.length; k++) if (mine[k].id === cardId) { i = k; break; }
    if (i < 0) return { error: "card_not_in_hand" };

    var p = alive.indexOf(orig);
    var G = NN.importState(engineFrom(snap), rnd);
    if (G.legal(p).indexOf(i) < 0) return { error: "illegal_card" };
    var kk = opt.k == null ? 0 : opt.k, card = mine[i];
    var sealed = !!G.seal[p], os = sealed ? [{ fx: "" }] : G.opts(card.n);
    if (!(kk >= 0 && kk < os.length && kk === Math.floor(kk))) return { error: "bad_option" };
    var tgIdx = null;
    if (!sealed && G.needsTarget(os[kk].fx) && alive.length > 2) {
      tgIdx = alive.indexOf(opt.tg);
      if (tgIdx < 0 || tgIdx === p) return { error: "need_target" };
    }
    var r = G.play(p, i, kk, tgIdx == null ? undefined : tgIdx);
    var last = lastFrom(pub, orig, r, alive, "play");
    if (r.bust) { var b = bustResult(snap, G, orig, last, "play", rnd); b.action = { p: orig, card_id: cardId, last: last }; return b; }
    var res = finish(snap, G, last, "play");
    res.action = { p: orig, card_id: cardId, k: kk, tg: opt.tg == null ? null : opt.tg, last: last };
    return res;
  }

  // ข้ามการลงเพิ่มของ Chariot
  function applyPass(snap, uid, rnd) {
    var c0 = baseCheck(snap, uid); if (c0.error) return c0;
    var pub = snap.pub, orig = c0.orig;
    if (!pub.pend || pub.pend.t !== "extra") return { error: "no_pending" };
    if (pub.pend.p !== orig) return { error: "not_your_turn" };
    var G = NN.importState(engineFrom(snap), rnd), p = pub.alive.indexOf(orig);
    if (!G.pass(p)) return { error: "no_pending" };
    var last = { seq: pub.seq_n, kind: "pass", p: orig, n: null, id: null, t: "", before: pub.total, after: pub.total, heat: 0, fx: null, saved: false, bust: false };
    var res = finish(snap, G, last, "pass"); res.action = { p: orig, pass: true, last: last }; return res;
  }

  // The Moon: เลือกไพ่ในมือที่จะทิ้งกี่ใบก็ได้ (ix = ดัชนีในมือ ไม่ซ้ำ) แล้วจั่วใหม่เท่าจำนวนที่ทิ้ง
  function applySwap(snap, uid, ix, rnd) {
    var c0 = baseCheck(snap, uid); if (c0.error) return c0;
    var pub = snap.pub, orig = c0.orig;
    if (!pub.pend || pub.pend.t !== "moon") return { error: "no_pending" };
    if (pub.pend.p !== orig) return { error: "not_your_turn" };
    var G = NN.importState(engineFrom(snap), rnd), p = pub.alive.indexOf(orig);
    if (!Array.isArray(ix) || ix.length > 12) return { error: "bad_option" };
    var seen = {}, hl = G.hands[p].length;
    for (var j = 0; j < ix.length; j++) {
      if (!Number.isInteger(ix[j]) || ix[j] < 0 || ix[j] >= hl || seen[ix[j]]) return { error: "bad_option" };
      seen[ix[j]] = 1;
    }
    var r = G.swap(p, ix);
    if (!r) return { error: "no_pending" };
    var last = { seq: pub.seq_n, kind: "swap", p: orig, n: null, id: null, t: "", k: r.k, before: pub.total, after: pub.total, heat: 0, fx: null, saved: false, bust: false };
    var res = finish(snap, G, last, "swap"); res.action = { p: orig, swap: r.k, last: last }; return res;
  }

  // The Empress แทรกเทิร์น (ผู้เล่นที่ไม่ใช่ตาของตัวเอง)
  function applyInterject(snap, uid, rnd) {
    var c0 = baseCheck(snap, uid); if (c0.error) return c0;
    var pub = snap.pub, orig = c0.orig, alive = pub.alive;
    var G = NN.importState(engineFrom(snap), rnd), p = alive.indexOf(orig);
    if (G.canInterject(p) < 0) return { error: "cant_interject" };
    var r = G.interject(p);
    var last = lastFrom(pub, orig, r, alive, "interject"); last.interject = true;
    if (r.bust) { var b = bustResult(snap, G, orig, last, "interject", rnd); b.action = { p: orig, interject: true, last: last }; return b; }
    var res = finish(snap, G, last, "interject"); res.action = { p: orig, interject: true, last: last }; return res;
  }

  /* ยอมแพ้ (หมดเวลา/หลุด/ออก) = ตกรอบ ; ถ้าเป็นโหมดเดี่ยวหรือเหลือ 2 คน = เกมจบ */
  function applyForfeit(snap, orig, reason, rnd) {
    var pub = snap.pub;
    if (!pub || pub.over >= 0) return { error: "game_over" };
    if (pub.alive.indexOf(orig) < 0) return { error: "eliminated" };
    var last = { seq: pub.seq_n, kind: "forfeit", p: orig, n: null, id: null, t: "", before: pub.total, after: pub.total, heat: 0, fx: null, saved: false, bust: false, forfeit: true, reason: reason, elim: orig };
    var log = (pub.log || []).concat([last]).slice(-LOG_MAX);
    var meta = { mode: pub.mode, out: pub.out, seq: pub.seq_n + 1, turns: pub.turns, over: -1, winner: null, players: pub.players, last: last, log: log };
    var res = eliminate(snap, null, orig, meta, false, rnd);
    res.action = { p: orig, forfeit: true, reason: reason, last: last };
    return res;
  }

  function summary(pub) {
    return { loser: pub.over, winner: pub.winner, turns: pub.turns, total: pub.last ? pub.last.after : pub.total, cap: pub.cap, out: pub.out };
  }

  return { startGame: startGame, applyPlay: applyPlay, applyPass: applyPass, applySwap: applySwap, applyInterject: applyInterject, applyForfeit: applyForfeit, summary: summary, copy: copy };
});

/* ===== online/war-engine.js ===== */
/* HRTA สงครามไพ่ "ยุทธวิธี" (ไม่มีพลังพิเศษ) — engine ฟังก์ชันล้วน ใช้ร่วม client + server (Supabase Edge Function)
 * ส่วนระหว่าง TACTICS_ENGINE_START / TACTICS_ENGINE_END ต้องเหมือนกับที่ฝังใน index.html ทุกตัวอักษร (tests/war-parity ตรวจ)
 * กติกาและลำดับตัดสินดู docs/war-tactics-balance.md
 * ความลับ: engine เก็บสถานะเต็ม (มือ/กองจั่ว) ไว้ฝั่งเซิร์ฟเวอร์เท่านั้น ส่งให้ผู้เล่นผ่าน E.view(p) / E.pub() เท่านั้น
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WarTactics = factory();
})(typeof self !== "undefined" ? self : this, function () {
/*TACTICS_ENGINE_START*/
function wtEngine(R0, rnd) {
  var R = {clash: "u", fool: 1, hand: 3, wh: 7, cap: 60, raise: 1, raiseMax: 2};
  for (var k0 in (R0 || {})) R[k0] = R0[k0];
  rnd = rnd || Math.random;
  var shuf = function (a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t } return a };
  var E = {R: R, deck: [], hands: [[], []], piles: [[], []], disc: [], pot: [], up: [null, null], cs: null, stk: [null, null],
    round: 0, wars: 0, depth: 0, phase: "play", over: null, pub: {}, own: [{}, {}], rz: [0, 0], ev: [],
    st: {rw: [0, 0], ww: [0, 0], ret: [0, 0], maxd: 0, pot: 0}};
  var mark = function (cards) { cards.forEach(function (c) { if (c) E.pub[c.id] = 1 }) };
  var cnum = function (c) { return c ? c.n : -1 };
  var rmId = function (arr, id) { for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr.splice(i, 1)[0]; return null };
  var hasId = function (arr, id) { for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return true; return false };
  var emit = function (o) { E.ev.push(o) };

  E.deal = function () {
    var d = []; for (var k = 0; k < 2; k++) for (var n = 0; n < 22; n++) d.push({n: n, d: k, id: k * 22 + n});
    shuf(d); E.hands = [d.slice(0, R.hand), d.slice(R.hand, 2 * R.hand)]; E.deck = d.slice(2 * R.hand);
    E.piles = [[], []]; E.disc = []; E.pot = []; E.round = 0; E.wars = 0; E.phase = "play"; E.over = null;
    E.pub = {}; E.own = [{}, {}]; E.rz = [0, 0];
    return E;
  };
  E.clashes = function (a, b) { if (a === b) return true; if (R.clash === "eq") return false; if (a % 10 === b % 10) return true; return R.clash === "un" && Math.abs(a - b) === 1 };
  E.draw = function (p) { var c = E.deck.shift(); if (!c) return null; E.hands[p].push(c); return c };
  var drawTo = function (n) { /* จั่วสลับฝั่ง จนมือ >= n หรือกองหมด; ฝั่งที่เริ่มก่อนสลับทุกรอบ */
    var f = E.round % 2, go = true;
    while (go && E.deck.length) { go = false; for (var i = 0; i < 2; i++) { var p = (f + i) % 2; if (E.hands[p].length < n && E.deck.length) { E.draw(p); go = true } } }
  };

  /* ---------- ตรวจการเลือก ---------- */
  E.legalPlay = function (p, ch) {
    if (!(ch && E.phase === "play" && !E.over && hasId(E.hands[p], ch.c))) return false;
    if (ch.x == null) return true;
    return !!R.raise && E.rz[p] < R.raiseMax && ch.x !== ch.c && hasId(E.hands[p], ch.x);
  };
  E.needDown = function (p) { return Math.min(3, Math.max(0, E.hands[p].length - 1)) };
  E.legalWar = function (p, ch) {
    if (E.phase !== "war" || E.over) return false;
    if (!E.hands[p].length) return true;
    if (!ch) return false; if (ch.r) return true;
    var h = E.hands[p], d = ch.down || [], nd = E.needDown(p), seen = {};
    if (d.length !== nd || ch.up == null) return false;
    var all = d.concat([ch.up]);
    for (var i = 0; i < all.length; i++) { if (seen[all[i]] || !hasId(h, all[i])) return false; seen[all[i]] = 1 }
    return true;
  };

  /* ---------- ขั้นตอนหลัก ---------- */
  E.step = function (ch) {
    E.ev = [];
    if (E.over) return E.ev;
    if (E.phase === "play") playStep(ch); else warStep(ch);
    return E.ev;
  };

  function playStep(ch) {
    var cs = [], p;
    for (p = 0; p < 2; p++) { if (!E.legalPlay(p, ch && ch[p])) throw new Error("illegal play p" + p); }
    for (p = 0; p < 2; p++) cs.push(rmId(E.hands[p], ch[p].c));
    var stk = [null, null];
    if (R.raise) for (p = 0; p < 2; p++) if (ch[p].x != null) { stk[p] = rmId(E.hands[p], ch[p].x); E.rz[p]++ }
    E.stk = stk; mark(stk.filter(Boolean));
    E.cs = cs; E.round++; E.up = cs.slice(); E.pot = cs.concat(stk.filter(Boolean)); E.depth = 0; mark(cs);
    emit({t: "flip", r: E.round, up: cs.map(cnum), stk: stk.map(function (c) { return c ? c.n : -1 })});
    var a = cs[0].n, b = cs[1].n, fw = -1;
    if (R.fool) { if (a === 0 && b === 21) fw = 0; else if (a === 21 && b === 0) fw = 1 }
    if (fw >= 0) return settle(fw, false, {fool: true});
    if (E.clashes(a, b)) return startWar();
    return settle(a > b ? 0 : 1, false, {});
  }

  function startWar() {
    E.wars++; E.depth++; if (E.depth > E.st.maxd) E.st.maxd = E.depth;
    E.phase = "war";
    drawTo(R.wh);
    emit({t: "war", d: E.depth, pot: E.pot.length, ups: E.up.map(cnum)});
  }

  function warStep(ch) {
    var p, mode = ["f", "f"];
    for (p = 0; p < 2; p++) {
      if (!E.hands[p].length) mode[p] = "x";
      else { if (!E.legalWar(p, ch && ch[p])) throw new Error("illegal war p" + p); if (ch[p].r) mode[p] = "r" }
    }
    if (mode[0] === "f" && mode[1] === "f") {
      var ups = [], downN = [0, 0];
      for (p = 0; p < 2; p++) {
        var dn = ch[p].down.map(function (id) { return rmId(E.hands[p], id) });
        dn.forEach(function (c) { E.own[p][c.id] = 1 });
        downN[p] = dn.length; E.pot = E.pot.concat(dn); ups.push(rmId(E.hands[p], ch[p].up));
      }
      E.pot = E.pot.concat(ups); E.up = ups; mark(ups);
      emit({t: "lay", ups: ups.map(cnum), dn: downN, pot: E.pot.length});
      var a = ups[0].n, b = ups[1].n, fw = -1;
      if (R.fool) { if (a === 0 && b === 21) fw = 0; else if (a === 21 && b === 0) fw = 1 }
      if (fw >= 0) return settle(fw, true, {fool: true});
      if (E.clashes(a, b)) return startWar();
      return settle(a > b ? 0 : 1, true, {});
    }
    /* มีคนถอย/ไพ่หมด */
    var pot = E.pot.slice(); E.pot = []; E.up = [null, null];
    var f = mode[0] === "f" ? 0 : mode[1] === "f" ? 1 : -1;
    for (p = 0; p < 2; p++) if (mode[p] === "r") E.st.ret[p]++;
    if (f < 0) {
      mark(pot); E.disc = E.disc.concat(pot); emit({t: "ret", both: true, n: pot.length, d: E.depth});
    } else {
      var q = 1 - f;
      E.piles[f] = E.piles[f].concat(pot); mark(pot);
      emit({t: "ret", p: q, w: f, n: pot.length, d: E.depth, forfeit: mode[q] === "x"});
      E.st.rw[f]++; E.st.ww[f]++;
      if (pot.length > E.st.pot) E.st.pot = pot.length;
    }
    E.depth = 0;
    endRound();
  }

  function settle(w, war, o) {
    var pot = E.pot.slice(), depth = E.depth;
    E.piles[w] = E.piles[w].concat(pot); mark(pot);
    E.st.rw[w]++; if (war) E.st.ww[w]++; if (pot.length > E.st.pot) E.st.pot = pot.length;
    if (o.fool) emit({t: "fool", p: w});
    emit({t: "res", w: w, n: pot.length, war: war ? depth : 0, up: E.up.map(cnum)});
    endRound();
  }

  function endRound() {
    drawTo(R.hand);
    E.up = [null, null]; E.pot = []; E.phase = "play";
    if (!E.deck.length && (!E.hands[0].length || !E.hands[1].length)) E.over = "done";
    else if (E.round >= R.cap) E.over = "cap";
    if (E.over) emit({t: "end", why: E.over, s: [E.piles[0].length, E.piles[1].length]});
  }
  E.result = function () { var a = E.piles[0].length, b = E.piles[1].length; return {w: a > b ? 0 : b > a ? 1 : -1, a: a, b: b} };

  /* ---------- มุมมอง ---------- */
  E.pubState = function () { /* ข้อมูลสาธารณะ: ไม่มีมือ/กองจั่ว/ไพ่ที่เลือกแต่ยังไม่เปิด/ไพ่คว่ำ */
    return {round: E.round, phase: E.phase, depth: E.depth, over: E.over, deckN: E.deck.length, handN: [E.hands[0].length, E.hands[1].length],
      pileN: [E.piles[0].length, E.piles[1].length], discN: E.disc.length, potN: E.pot.length,
      up: E.up.map(function (c) { return c ? {n: c.n, d: c.d, id: c.id} : null }), cfg: {clash: R.clash, fool: R.fool}};
  };
  E.view = function (p) {
    var v = E.pubState(), unseen = [], i;
    v.rzLeft = R.raise ? Math.max(0, R.raiseMax - E.rz[p]) : 0; v.p = p; v.hand = E.hands[p].slice(); v.pile = E.piles[p].slice();
    for (i = 0; i < 44; i++) { if (E.pub[i] || E.own[p][i] || hasId(E.hands[p], i)) continue; unseen.push({n: i % 22, d: Math.floor(i / 22), id: i}) }
    v.unseen = unseen; v.R = {clash: R.clash, fool: R.fool, hand: R.hand, wh: R.wh, cap: R.cap, raise: R.raise, raiseMax: R.raiseMax};
    v.need = E.phase === "war" ? E.needDown(p) : 0;
    return v;
  };

  /* ---------- บันทึก/โหลดสถานะ (ใช้ในตัวจำลองของ AI และเซิร์ฟเวอร์) ---------- */
  E.save = function () {
    return {deck: E.deck.slice(), hands: [E.hands[0].slice(), E.hands[1].slice()], piles: [E.piles[0].slice(), E.piles[1].slice()], disc: E.disc.slice(),
      pot: E.pot.slice(), up: E.up.slice(), cs: E.cs, stk: E.stk || [null, null], round: E.round, wars: E.wars, depth: E.depth, phase: E.phase, over: E.over,
      pub: Object.assign({}, E.pub), own: [Object.assign({}, E.own[0]), Object.assign({}, E.own[1])], rz: E.rz.slice(), st: JSON.parse(JSON.stringify(E.st))};
  };
  E.load = function (s) {
    for (var k in s) { var v = s[k]; E[k] = (v && typeof v === "object") ? JSON.parse(JSON.stringify(v)) : v }
    return E;
  };
  return E;
}
/*TACTICS_ENGINE_END*/

/*TACTICS_AI_START*/
/* ===================== AI "น้องเบสท์" (เล่นแฟร์: รับ view ของตัวเองเท่านั้น) ===================== */
var LEVELS = {
  random: {kind: "random"},
  novice: {kind: "mc", samples: 3, noise: 0.7, count: false},
  normal: {kind: "mc", samples: 8, noise: 0, count: false},
  hard:   {kind: "mc", samples: 20, noise: 0, count: true},
  retreatAlways: {kind: "mc", samples: 8, noise: 0, count: false, war: "retreat"},
  retreatNever:  {kind: "mc", samples: 8, noise: 0, count: false, war: "fight"}
};
var FULL = []; for (var _k = 0; _k < 2; _k++) for (var _n = 0; _n < 22; _n++) FULL.push({n: _n, d: _k, id: _k * 22 + _n});

function pickRand(arr, rnd) { return arr[Math.floor(rnd() * arr.length)] }
function shuffled(a, rnd) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t } return a }

/* กลุ่มไพ่ที่ฝั่งตรงข้ามน่าจะถืออยู่ (ตามข้อมูลที่ AI เห็นได้) */
function oppPool(view, lv) {
  if (lv.count) return view.unseen;
  var mine = {}; view.hand.forEach(function (c) { mine[c.id] = 1 });
  return FULL.filter(function (c) { return !mine[c.id] });
}
function sampleOpp(view, lv, rnd, n) {
  var known = [], kid = {};
  var pool = shuffled(oppPool(view, lv).filter(function (c) { return !kid[c.id] }), rnd);
  var take = pool.slice(0, Math.max(0, n - known.length));
  var hh = known.concat(take);
  while (hh.length < n) hh.push(FULL[Math.floor(rnd() * 44)]); /* ข้อมูลที่เห็นไม่พอ (ไพ่ซ่อนในกองรางวัล) → เติมสุ่ม */
  return {hand: hh, rest: pool.slice(take.length)};
}

/* สร้างสถานะจำลองจากมุมมองของ me (ฝั่งตรงข้าม+กองจั่วสุ่มจากสิ่งที่ยังไม่เห็น) */
function determinize(view, lv, rnd) {
  var me = view.p, o = 1 - me, R = Object.assign({}, view.R);
  var s = sampleOpp(view, lv, rnd, view.handN[o]);
  var dummy = function (n) { var a = []; for (var i = 0; i < n; i++) a.push({n: 5, d: 0, id: 100 + i}); return a };
  var deck = s.rest.slice(0, view.deckN);
  while (deck.length < view.deckN) deck.push({n: Math.floor(rnd() * 22), d: 0, id: 200 + deck.length});
  var sim = wtEngine(R, rnd);
  var st = {deck: deck, hands: [[], []], piles: [[], []], disc: dummy(view.discN), pot: [], up: [null, null], cs: null, stk: [null, null],
    round: view.round, wars: 0, depth: 0, phase: "play", over: null, pub: {}, own: [{}, {}],
    rz: me === 0 ? [Math.max(0, view.R.raiseMax - view.rzLeft), 0] : [0, Math.max(0, view.R.raiseMax - view.rzLeft)],
    st: {rw: [0, 0], ww: [0, 0], ret: [0, 0], maxd: 0, pot: 0}};
  st.hands[me] = view.hand.slice(); st.hands[o] = s.hand;
  st.piles[me] = view.pile.slice(); st.piles[o] = dummy(view.pileN[o]);
  return sim.load(st);
}

function rank(c) { return c.n }

/* ตัดสินใจในสงคราม: คืน {r:1} หรือ {down:[ids], up:id} */
function warDecide(view, lvName, rnd) {
  var lv = LEVELS[lvName] || LEVELS.normal, h = view.hand.slice().sort(function (a, b) { return a.n - b.n });
  var nd = view.need;
  var legalFight = function () { var up = h[h.length - 1]; return {down: h.slice(0, nd).map(function (c) { return c.id }), up: up.id} };
  if (lv.kind === "random") {
    if (rnd() < 0.2) return {r: 1};
    var sh = shuffled(h, rnd); return {down: sh.slice(0, nd).map(function (c) { return c.id }), up: sh[nd].id};
  }
  if (lv.war === "retreat") return {r: 1};
  var fight = legalFight();
  if (lv.war === "fight") return fight;
  if (lv.noise && rnd() < lv.noise) { if (rnd() < 0.5) return fight; var sh2 = shuffled(h, rnd); return {down: sh2.slice(0, nd).map(function (c) { return c.id }), up: sh2[nd].id} }
  /* ประเมินโอกาสชนะใบตัดสิน เทียบมือคู่ต่อสู้ที่สุ่มจากข้อมูลที่เห็น (คู่ต่อสู้เลือกใบสูงสุด) */
  var mine = h[h.length - 1].n, W = 0, K = 40, oppN = view.handN[1 - view.p];
  if (!oppN) return fight;
  for (var i = 0; i < K; i++) {
    var oh = sampleOpp(view, lv, rnd, oppN).hand, ob = -1; oh.forEach(function (c) { if (c.n > ob) ob = c.n });
    var cl = (mine === ob) || (view.R.clash !== "eq" && mine % 10 === ob % 10) || (view.R.clash === "un" && Math.abs(mine - ob) === 1);
    W += cl ? 0.5 : (mine > ob ? 1 : (view.R.fool && mine === 0 && ob === 21 ? 1 : (view.R.fool && mine === 21 && ob === 0) ? 0 : 0));
  }
  var p = W / K, T = view.potN + (nd + 1) * 2;
  var cost = view.potN;
  return ((2 * p - 1) * T > -cost) ? fight : {r: 1};
}

/* เลือกไพ่ลงรอบปกติ: คืน {c:id, mag, jud, star, her} */
function playDecide(view, lvName, rnd) {
  var lv = LEVELS[lvName] || LEVELS.normal, hand = view.hand;
  if (lv.kind === "random" || hand.length === 1) { var rc = pickRand(hand, rnd), ro = {c: rc.id}; if (view.rzLeft > 0 && hand.length > 1 && rnd() < 0.3) ro.x = pickRand(hand.filter(function (x) { return x.id !== rc.id }), rnd).id; return ro }
  if (lv.noise && rnd() < lv.noise) return {c: pickRand(hand, rnd).id};
  var me = view.p, o = 1 - me, late = view.deckN <= 2;
  /* ตัวเลือก: ลงใบ c เฉย ๆ หรือลง c + เพิ่มเดิมพันด้วยใบอื่นที่ต่ำสุด */
  var acts = [];
  hand.forEach(function (c) {
    acts.push({c: c.id});
    if (view.rzLeft > 0 && hand.length > 1) {
      var low = null; hand.forEach(function (x) { if (x.id !== c.id && (!low || x.n < low.n)) low = x });
      acts.push({c: c.id, x: low.id});
    }
  });
  var scores = acts.map(function () { return 0 });
  for (var s = 0; s < lv.samples; s++) {
    var base = determinize(view, lv, rnd).save();
    var oh = base.hands[o], oc = pickRand(oh, rnd), ox = null;
    if (view.R.raise && oh.length > 1 && rnd() < 0.2) ox = pickRand(oh.filter(function (x) { return x.id !== oc.id }), rnd);
    acts.forEach(function (a, ai) {
      var sim = wtEngine(view.R, rnd).load(base), oa = {c: oc.id}; if (ox) oa.x = ox.id;
      try {
        sim.step(me === 0 ? [a, oa] : [oa, a]);
        var guard = 0;
        while (sim.phase === "war" && !sim.over && guard++ < 6) {
          var ch = [null, null];
          for (var q = 0; q < 2; q++) ch[q] = warDecide(sim.view(q), "normal", rnd);
          sim.step(ch);
        }
      } catch (e) { return }
      var diff = sim.piles[me].length - sim.piles[o].length, hq = 0;
      sim.hands[me].forEach(function (x) { hq += x.n / 21 - 0.5 }); sim.hands[o].forEach(function (x) { hq -= (x.n / 21 - 0.5) * 0 });
      scores[ai] += diff + (late ? 0 : (lv.keep == null ? 0.5 : lv.keep) * hq);
    });
  }
  var bi = 0; for (var i = 1; i < acts.length; i++) if (scores[i] > scores[bi] + 1e-9) bi = i;
  return acts[bi];
}

var PRESET = {clash: "u", fool: 1, hand: 3, wh: 7, cap: 60, raise: 1, raiseMax: 2};
/*TACTICS_AI_END*/

return {engine: wtEngine, PRESET: PRESET, LEVELS: LEVELS, playDecide: playDecide, warDecide: warDecide, determinize: determinize};
});

/* ===== online/war-server.js ===== */
/* HRTA สงครามไพ่ยุทธวิธี (ออนไลน์) — ตรรกะฝั่งเซิร์ฟเวอร์แบบฟังก์ชันล้วน (ไม่แตะฐานข้อมูล ทดสอบบน Node ได้)
 * snap = { pub, secret:{deck, rest, pend}, hands:{uid:[card]}, uids:[uidผู้เล่น0, uidผู้เล่น1] }
 *   pub    = สถานะสาธารณะ (เก็บใน games.public_state)  — ห้ามมี มือ/กองจั่ว/ไพ่ที่เลือกแต่ยังไม่เปิด/ไพ่คว่ำ
 *   secret = สถานะลับของ engine + pend (การเลือกที่ยังไม่เปิด)
 * ทุกฟังก์ชันคืนผลใหม่ ไม่แก้ snap เดิม; ความผิดพลาดที่คาดได้คืน { error }
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./war-engine.js"));
  else root.WarServer = factory(root.WarTactics);
})(typeof self !== "undefined" ? self : this, function (WT) {
  "use strict";
  var clone = function (x) { return JSON.parse(JSON.stringify(x)) };
  var isInt = function (v) { return Number.isInteger(v) && v >= 0 && v < 1000 };

  function rConfig(cfg) { return Object.assign({}, WT.PRESET, { clash: cfg.clash, fool: cfg.fool ? 1 : 0 }) }
  function cleanCfg(cfg) {
    cfg = cfg || {};
    var cl = cfg.clash == null ? "u" : cfg.clash;
    if (["u", "un", "eq"].indexOf(cl) < 0) return null;
    return { clash: cl, fool: (cfg.fool === 0 || cfg.fool === false || cfg.fool === "0") ? 0 : 1 };
  }

  function loadEngine(snap, rnd) {
    var E = WT.engine(rConfig(snap.pub.cfg), rnd);
    var st = clone(snap.secret.rest);
    st.deck = clone(snap.secret.deck);
    st.hands = [clone(snap.hands[snap.uids[0]]), clone(snap.hands[snap.uids[1]])];
    E.load(st);
    return E;
  }
  function dump(E, uids) {
    var s = E.save(), hands = {}; hands[uids[0]] = s.hands[0]; hands[uids[1]] = s.hands[1];
    var deck = s.deck; delete s.deck; delete s.hands;
    return { deck: deck, rest: s, hands: hands };
  }
  function autoMark(E, pend) { /* สงคราม: คนที่ไพ่หมดมือไม่ต้องเลือก (ถือว่าแพ้ศึกนั้น) */
    if (E.phase === "war" && !E.over) for (var p = 0; p < 2; p++) if (!E.hands[p].length && !pend[p]) pend[p] = { auto: 1 };
  }
  function buildPub(E, players, cm, evs, rs) {
    var p = E.pubState();
    p.players = players; p.cm = cm; p.rs = rs; p.ev = evs; p.rz = E.rz.slice();   /* จำนวนครั้งที่เพิ่มเดิมพันไปแล้ว (เปิดเผยอยู่แล้วตอนเปิดไพ่) */
    p.need = [E.phase === "war" ? E.needDown(0) : 0, E.phase === "war" ? E.needDown(1) : 0];
    p.cfg = { clash: E.R.clash, fool: E.R.fool ? 1 : 0 };
    p.res = null;
    if (E.over) { var r = E.result(); p.res = { w: r.w, a: r.a, b: r.b, why: E.over } }
    return p;
  }
  function overCode(E) { if (!E.over) return -1; var r = E.result(); return r.w === 0 ? 1 : r.w === 1 ? 0 : -2 }

  /* players: [{user_id, seat, name, avatar}] เรียงตามที่นั่ง ; cfg: {clash, fool} */
  function startGame(players, cfg, rnd) {
    var c = cleanCfg(cfg); if (!c) return { error: "bad_cfg" };
    if (!players || players.length !== 2) return { error: "bad_player_count" };
    var E = WT.engine(rConfig(c), rnd).deal(), uids = players.map(function (p) { return p.user_id });
    var pend = [null, null];
    var d = dump(E, uids);
    var pub = buildPub(E, players.map(function (p) { return { seat: p.seat, name: p.name, avatar: p.avatar } }), [false, false], [], 0);
    return { pub: pub, secret: { deck: d.deck, rest: d.rest, pend: pend }, hands: d.hands };
  }

  /* คืนข้อมูลที่ผู้เล่นรู้ได้เองจากการเลือกของตัวเอง — ตรวจรูปแบบแล้วคัดเฉพาะคีย์ที่อนุญาต */
  function normChoice(phase, ch) {
    if (!ch || typeof ch !== "object") return null;
    if (phase === "play") {
      if (!isInt(ch.c)) return null;
      var o = { c: ch.c }; if (ch.x != null) { if (!isInt(ch.x)) return null; o.x = ch.x } return o;
    }
    if (ch.r) return { r: 1 };
    if (!Array.isArray(ch.down) || ch.down.length > 3 || !ch.down.every(isInt) || !isInt(ch.up)) return null;
    return { down: ch.down.slice(), up: ch.up };
  }

  function applyChoice(snap, uid, choice, rnd) {
    var p = snap.uids.indexOf(uid);
    if (p < 0) return { error: "not_in_game" };
    if (snap.pub.over) return { error: "game_over" };
    var pend = (snap.secret.pend || [null, null]).slice();
    if (pend[p]) return { error: "already_chosen" };
    var ch = normChoice(snap.pub.phase, choice);
    if (!ch) return { error: "illegal" };
    var E = loadEngine(snap, rnd);
    var ok = snap.pub.phase === "play" ? E.legalPlay(p, ch) : E.legalWar(p, ch);
    if (!ok) return { error: "illegal" };
    pend[p] = ch;
    var cm = [!!pend[0], !!pend[1]];
    if (!(pend[0] && pend[1])) { /* ยังรออีกฝั่ง: เก็บการเลือกไว้ลับ เผยแค่ "ยืนยันแล้ว" */
      var pub1 = clone(snap.pub); pub1.cm = cm;
      return { pub: pub1, secret: { deck: snap.secret.deck, rest: snap.secret.rest, pend: pend }, hands: clone(snap.hands), over: -1, resolved: false, type: "choice" };
    }
    /* ทั้งคู่ยืนยัน → เปิดไพ่พร้อมกันและตัดสิน */
    var evs = [], guard = 0, chs = [pend[0].auto ? null : pend[0], pend[1].auto ? null : pend[1]];
    evs = evs.concat(E.step(chs));
    pend = [null, null]; autoMark(E, pend);
    while (!E.over && E.phase === "war" && pend[0] && pend[1] && guard++ < 10) { evs = evs.concat(E.step([null, null])); pend = [null, null]; autoMark(E, pend) }
    var d = dump(E, snap.uids), pub = buildPub(E, snap.pub.players, [!!pend[0], !!pend[1]], evs, (snap.pub.rs || 0) + 1);
    return { pub: pub, secret: { deck: d.deck, rest: d.rest, pend: pend }, hands: d.hands, over: overCode(E), resolved: true, type: "resolve" };
  }

  /* เริ่มเกมแล้วอาจต้อง auto-mark (ไม่เกิดตอนเริ่ม แต่เผื่อไว้) — ยอมแพ้: idx = ผู้เล่นที่แพ้ ; idx = -1 = ทั้งคู่ทิ้งเกม (เสมอ) */
  function applyForfeit(snap, idx, reason) {
    if (snap.pub.over) return { error: "game_over" };
    var pub = clone(snap.pub), a = pub.pileN[0], b = pub.pileN[1];
    pub.over = "forfeit"; pub.cm = [false, false]; pub.rs = (pub.rs || 0) + 1;
    pub.res = idx < 0 ? { w: -1, a: a, b: b, why: "abandoned", reason: reason } : { w: 1 - idx, a: a, b: b, why: "forfeit", forfeit: idx, reason: reason };
    pub.ev = [{ t: "end", why: pub.res.why, s: [a, b], forfeit: idx, reason: reason }];
    return { pub: pub, secret: snap.secret, hands: clone(snap.hands), over: idx < 0 ? -2 : idx, type: "forfeit" };
  }

  return { startGame: startGame, applyChoice: applyChoice, applyForfeit: applyForfeit, cleanCfg: cleanCfg, loadEngine: loadEngine };
});

/* ===== online/war-api-core.js ===== */
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

/* ===== online/nn-api-core.js ===== */
/* HRTA Number Ceiling — แกนของ Edge Function `nn-api` (ไม่ผูกกับ Deno/Supabase โดยตรง จึงทดสอบบน Node ได้)
 * deps = { admin: supabase client แบบ service_role, rnd: ตัวสุ่มปลอดภัย, now?: () => ms }
 * handle(uid, body) -> object เสมอ (ความผิดพลาดที่คาดได้ส่งเป็น { error: "code" } ไม่ throw)
 * uid ต้องมาจากการตรวจ JWT ในชั้นนอก (index.ts) ไม่เคยเชื่อค่าจาก body
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./nn-server.js"), require("./war-api-core.js"));
  else root.NNApi = factory(root.NNServer, root.WarApi);
})(typeof self !== "undefined" ? self : this, function (SV, WA) {
  "use strict";
  var TURN_MS = 60000;
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function create(deps) {
    var admin = deps.admin, rnd = deps.rnd;
    var now = deps.now || function () { return Date.now(); };
    var log = deps.log || function () {};
    var warApi = WA ? WA.create(deps) : null;   // สงครามไพ่ยุทธวิธี (action ขึ้นต้น war_)

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
      if (room.game_type && room.game_type !== "nn") return { error: "wrong_game" };
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

    var KINDS = { play: 1, pass: 1, swap: 1, interject: 1 };
    var optInt = function (v) { return v == null || Number.isInteger(v); };

    // ลงไพ่ / ข้าม (Chariot) / เลือกไพ่ที่จะทิ้ง (Moon) / แทรก (Empress) — ผ่านขั้นตอนเดียวกัน
    async function act(uid, b, kind) {
      if (!UUID.test(String(b.game_id || "")) || !UUID.test(String(b.request_id || ""))) return { error: "bad_request" };
      if (!Number.isInteger(b.expected_version)) return { error: "bad_request" };
      if (kind === "play" && !Number.isInteger(b.card_id)) return { error: "bad_request" };
      if (kind === "swap" && !Array.isArray(b.ix)) return { error: "bad_request" };
      if (!optInt(b.k) || !optInt(b.tg)) return { error: "bad_request" };
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

      var sec = await q(admin.from("game_secrets").select("deck,disc,pend").eq("game_id", game.id).maybeSingle());
      var rows = await q(admin.from("player_private_states").select("user_id,seat,hand,extra").eq("game_id", game.id));
      if (!sec || !rows.length) return { error: "game_not_found" };

      var pub = game.public_state, hands = {}, uids = [], extras = {};
      pub.players.forEach(function (pl, p) {
        var row = rows.filter(function (r) { return r.seat === pl.seat; })[0];
        uids[p] = row ? row.user_id : null;
      });
      if (uids.some(function (u) { return !u; })) return { error: "server_error" };
      rows.forEach(function (r) { hands[r.user_id] = r.hand; if (r.extra) extras[r.user_id] = r.extra; });
      var snap = { pub: pub, secret: sec, hands: hands, uids: uids, extras: extras };

      var out = kind === "play" ? SV.applyPlay(snap, uid, b.card_id, rnd, { k: b.k, tg: b.tg })
        : kind === "pass" ? SV.applyPass(snap, uid, rnd)
        : kind === "swap" ? SV.applySwap(snap, uid, b.ix, rnd)
        : SV.applyInterject(snap, uid, rnd);
      if (out.error) return { error: out.error };
      // การแทรก (Empress) ไม่รีเซ็ตเวลาของคนที่กำลังจะลง
      var dl = kind === "interject" && game.turn_deadline_at ? game.turn_deadline_at : deadline();
      var res = await q(admin.rpc("nn_commit_action", {
        p_game: game.id, p_expected: b.expected_version, p_user: uid, p_request: b.request_id,
        p_public: out.pub, p_secret: out.secret, p_hands: out.hands, p_cur: out.cur, p_over: out.over,
        p_deadline: dl, p_action: out.action, p_type: "play", p_extras: out.extras || {}
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
      var rows = await q(admin.from("player_private_states").select("user_id,seat,hand,extra").eq("game_id", game.id));
      var uids = [], hands = {}, extras = {};
      game.public_state.players.forEach(function (pl, p) {
        var row = rows.filter(function (r) { return r.seat === pl.seat; })[0];
        uids[p] = row ? row.user_id : null;
      });
      if (uids.some(function (u) { return !u; })) return { error: "server_error" };
      rows.forEach(function (r) { hands[r.user_id] = r.hand; if (r.extra) extras[r.user_id] = r.extra; });
      return { game: game, uids: uids, hands: hands, extras: extras };
    }

    // ผู้เล่น orig ยอมแพ้: โหมดเดี่ยว/เหลือ 2 คน = เกมจบ ; โหมดคัดออก = ตกรอบแล้วเล่นต่อ
    async function forfeitPlayer(L, orig, reason, caller) {
      var game = L.game;
      var sec = await q(admin.from("game_secrets").select("deck,disc,pend").eq("game_id", game.id).maybeSingle());
      if (!sec) return { error: "game_not_found" };
      var out = SV.applyForfeit({ pub: game.public_state, secret: sec, hands: L.hands, uids: L.uids, extras: L.extras }, orig, reason, rnd);
      if (out.error === "eliminated") return { ok: true, state: "out" };
      if (out.error) return { error: out.error };
      var uuid = deps.uuid ? deps.uuid() : (globalThis.crypto && globalThis.crypto.randomUUID ? globalThis.crypto.randomUUID() : null);
      var res = await q(admin.rpc("nn_commit_action", {
        p_game: game.id, p_expected: game.version, p_user: caller, p_request: uuid,
        p_public: out.pub, p_secret: out.secret, p_hands: out.hands, p_cur: out.cur, p_over: out.over,
        p_deadline: deadline(), p_action: out.action, p_type: "forfeit", p_extras: out.extras || {}
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
        if (typeof body.action === "string" && body.action.indexOf("war_") === 0) return warApi ? await warApi.handle(uid, body) : { error: "bad_action" };
        if (body.action === "start") return await start(uid, body);
        if (KINDS[body.action]) return await act(uid, body, body.action);
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
