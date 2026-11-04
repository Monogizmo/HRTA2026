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
     var G={cap:o.cap,n:o.n,two:o.n===2,hands:[],deck:[],disc:[],total:0,prev:0,dir:1,cur:0,over:-1,turn:0,band:9,shield:[],force:-1,heatAt:Math.round(o.cap/6),dbl:null,seal:[],owe:[],calm:[],rev:[],seq:null,pend:null};
     G.heat=function(){return G.turn>=G.heatAt?1+Math.floor((G.turn-G.heatAt)/6):0};
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
     G.needsTarget=function(fx){return fx==="fool"||fx==="seal"||fx==="moon"};
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
      case 18:return[{t:"+0 หงายไพ่",v:0,fx:"moon"}];
      case 19:return[{t:"+19 เปิดไพ่ 3 ใบ",v:19,fx:"sun"}];
      case 20:return[{t:"+20 ทุกคนล้างไพ่",v:20,fx:"all"}];
      case 21:return[{t:"ดันเป็น "+c,set:c,fx:"world"}];
      default:return[{t:"+"+n,v:n}]}};
     /* คำนวณผลของไพ่ 1 ใบ (ไฟลามทุ่ง โล่ ฯลฯ) — ใช้ร่วมกันทั้งการลงปกติและการแทรก */
     var calc=function(p,c,k,sealed){
      var o=sealed?{t:"+"+c.n,v:c.n}:G.opts(c.n)[k||0],b=G.total,fx=o.fx||"";
      var t=o.set!=null?o.set:Math.max(0,b+o.v);if(fx==="wheel")t=Math.max(0,b+Math.floor(rnd()*41)-15);
      var hh=G.heat();if(fx==="star"&&hh>0)G.calm[p]=2;if(fx==="world")hh=0;if(G.calm[p]>0){hh=0;G.calm[p]--}
      t+=hh;var saved=false;
      if(t>G.cap&&G.shield[p]){G.shield[p]=false;saved=true;t=Math.max(0,G.cap-15)}
      return{o:o,b:b,fx:fx,t:t,hh:hh,saved:saved}};
     var pickTg=function(p,tg){var a=G.targets(p);return a.indexOf(tg)>=0?tg:(a.length===1?a[0]:G.next(p))};
     /* ลงไพ่ 1 ใบ (tg = เป้าหมายของ Fool/Emperor/Moon) — ถ้ายังต้องรับคำสั่งต่อ (ลงใบที่ 2 / ลงเพิ่ม / เลือก Sun) จะตั้ง G.pend */
     G.play=function(p,i,k,tg){if(G.force===p)G.force=-1;
      var S=(G.seq&&G.seq.p===p)?G.seq:(G.seq={p:p,plays:0,max:1,forced:!!(G.dbl&&G.dbl.p===p),opt:false,sun:false,owed:0,post:[]});
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
       if(fx==="moon")G.rev[tg]=true}
      if(fx==="devil")S.post.push({fx:"devil",q:nx});
      if(fx==="sun")S.sun=true;
      if(fx==="chariot"&&!S.forced&&S.plays===1){S.opt=true;S.max=2}
      if(S.forced&&S.plays<2){G.pend={t:"forced",p:p};r.pend="forced";return r}
      if(S.opt&&S.plays<2){G.pend={t:"extra",p:p};r.pend="extra";return r}
      return G.finish(p,r)};
     /* จบการลงไพ่ของตา: Sun เปิดไพ่ 3 ใบให้เลือก 1 ใบแทนการจั่ว ไม่งั้นจั่วคืนตามจำนวนที่ลง */
     G.finish=function(p,r){var S=G.seq;
      if(S.sun){S.sun=false;var cs=[];for(var j=0;j<3;j++){if(!G.deck.length)G.deck=shuf(G.disc.splice(0));if(G.deck.length)cs.push(G.deck.shift())}
       if(cs.length>1){S.owed--;G.pend={t:"pick",p:p,cards:cs};r.pend="pick";r.cards=cs;return r}
       if(cs.length===1){S.owed--;G.hands[p].push(cs[0])}}
      return G.end(p,r)};
     G.pick=function(p,idx){var pd=G.pend;if(!pd||pd.t!=="pick"||pd.p!==p||!(idx>=0&&idx<pd.cards.length))return null;
      var cs=pd.cards.slice(),ch=cs.splice(idx,1)[0];G.hands[p].push(ch);G.deck=G.deck.concat(cs);G.pend=null;
      return G.end(p,{pick:true,p:p,c:ch,pend:null})};
     G.pass=function(p){var pd=G.pend;if(!pd||pd.t!=="extra"||pd.p!==p)return null;G.pend=null;return G.end(p,{pass:true,p:p,pend:null})};
     G.end=function(p,r){var S=G.seq;
      for(var j=0;j<S.owed;j++)G.draw(p);S.owed=0;
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
       os.forEach(function(o,k){var w=o.fx==="wheel",h2=o.fx==="world"?0:cm,t=(o.set!=null?o.set:w?G.total+5:Math.max(0,G.total+o.v))+h2,s;
        if(t>G.cap){s=G.shield[p]?G.cap-15-30+rnd()*4:-1000-(t-G.cap)}
        else{s=t+rnd()*7;if(RES.indexOf(c.n)>=0&&t<G.cap-25)s-=16;if(w&&G.total+25+h2>G.cap)s-=40}
        if(s>bs){bs=s;best={i:i,k:k,t:t,tg:G.needsTarget(o.fx)?(o.fx==="fool"?G.targets(p)[Math.floor(rnd()*(G.n-1))]:G.next(p)):null}}})});return best};
     G.aiStep=function(p){var pd=G.pend;
      if(pd&&pd.p===p&&pd.t==="pick"){var bi=0;pd.cards.forEach(function(c,i){if(c.n<pd.cards[bi].n)bi=i});return{t:"pick",idx:bi}}
      var b=G.aiBest(p);
      if(pd&&pd.p===p&&pd.t==="extra"&&!(b&&b.t<G.total))return{t:"pass"};
      return{t:"play",i:b.i,k:b.k,tg:b.tg}};
     G.aiInterject=function(p){return G.canInterject(p)>=0&&G.total+3+G.heat()<G.cap-25&&rnd()<.35};
     return G}

  /* ---- ส่วนเสริม (ไม่อยู่ใน engine เดิม): แปลง state เป็น JSON เพื่อเก็บใน DB ---- */
  var KEYS = ["cap", "n", "two", "hands", "deck", "disc", "total", "prev", "dir", "cur", "over", "turn", "shield", "dbl", "force", "heatAt", "seal", "owe", "calm", "rev", "seq", "pend"];
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
 * action ที่รองรับ: play (card_id, k, tg) · pass (ข้ามการลงเพิ่มของ Chariot) · pick (เลือกไพ่ Sun) · interject (Empress แทรกเทิร์น) · forfeit
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
      seq = { p: alive[G.seq.p], plays: G.seq.plays, max: G.seq.max, forced: G.seq.forced, opt: G.seq.opt, sun: G.seq.sun, owed: G.seq.owed,
        post: G.seq.post.map(function (e) { return e.fx === "swap" ? { fx: "swap", a: alive[e.a], b: alive[e.b] } : { fx: "devil", q: alive[e.q] }; }) };
    }
    return {
      v: 3, mode: meta.mode, np: np, alive: alive.slice(), out: meta.out.slice(),
      cap: G.cap, n: G.n, heatAt: G.heatAt,
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
      cap: pub.cap, n: alive.length, two: alive.length === 2, heatAt: pub.heatAt, total: pub.total, prev: pub.prev,
      dir: pub.dir, cur: inv(pub.cur), over: -1, turn: pub.turn,
      shield: pick(pub.shield).map(Boolean), seal: pick(pub.seal).map(Boolean), owe: pick(pub.owe).map(Boolean), calm: pick(pub.calm).map(function (x) { return x || 0; }), rev: rev,
      dbl: pub.dbl ? { p: inv(pub.dbl.p), left: pub.dbl.left } : null,
      force: pub.force < 0 ? -1 : inv(pub.force),
      seq: null, pend: null,
      deck: snap.secret.deck, disc: snap.secret.disc,
      hands: alive.map(function (o) { return snap.hands[snap.uids[o]]; })
    };
    if (pub.seq) {
      st.seq = { p: inv(pub.seq.p), plays: pub.seq.plays, max: pub.seq.max, forced: pub.seq.forced, opt: pub.seq.opt, sun: pub.seq.sun, owed: pub.seq.owed,
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
    if (pub.pend && pub.pend.t === "pick") return { error: pub.pend.p === orig ? "must_pick" : "not_your_turn" };
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

  // เลือกไพ่ 1 ใบจาก 3 ใบของ The Sun (ผู้เลือกเท่านั้นที่เห็นไพ่)
  function applyPick(snap, uid, idx, rnd) {
    var c0 = baseCheck(snap, uid); if (c0.error) return c0;
    var pub = snap.pub, orig = c0.orig;
    if (!pub.pend || pub.pend.t !== "pick") return { error: "no_pending" };
    if (pub.pend.p !== orig) return { error: "not_your_turn" };
    var G = NN.importState(engineFrom(snap), rnd), p = pub.alive.indexOf(orig);
    if (!(Number.isInteger(idx) && idx >= 0 && idx < G.pend.cards.length)) return { error: "bad_option" };
    if (!G.pick(p, idx)) return { error: "no_pending" };
    var last = { seq: pub.seq_n, kind: "pick", p: orig, n: null, id: null, t: "", before: pub.total, after: pub.total, heat: 0, fx: null, saved: false, bust: false };
    var res = finish(snap, G, last, "pick"); res.action = { p: orig, pick: idx, last: last }; return res;
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

  return { startGame: startGame, applyPlay: applyPlay, applyPass: applyPass, applyPick: applyPick, applyInterject: applyInterject, applyForfeit: applyForfeit, summary: summary, copy: copy };
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

    var KINDS = { play: 1, pass: 1, pick: 1, interject: 1 };
    var optInt = function (v) { return v == null || Number.isInteger(v); };

    // ลงไพ่ / ข้าม (Chariot) / เลือกไพ่ (Sun) / แทรก (Empress) — ผ่านขั้นตอนเดียวกัน
    async function act(uid, b, kind) {
      if (!UUID.test(String(b.game_id || "")) || !UUID.test(String(b.request_id || ""))) return { error: "bad_request" };
      if (!Number.isInteger(b.expected_version)) return { error: "bad_request" };
      if (kind === "play" && !Number.isInteger(b.card_id)) return { error: "bad_request" };
      if (kind === "pick" && !Number.isInteger(b.idx)) return { error: "bad_request" };
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
        : kind === "pick" ? SV.applyPick(snap, uid, b.idx, rnd)
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
