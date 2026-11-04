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
