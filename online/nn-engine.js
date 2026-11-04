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
