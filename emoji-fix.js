/* HRTA — ตัวช่วยแสดงอีโมจิบนเครื่องที่ฟอนต์ยังไม่รองรับ (เช่น Windows 10 ไม่มี 🪙 และอีโมจิรุ่น Emoji 13+ จะเห็นเป็นกล่อง □)
 * ทำงานเฉพาะบนเครื่องที่ "ตรวจพบว่าวาดไม่ได้จริง" — เครื่องที่รองรับอยู่แล้ว (มือถือ, Mac, Windows 11) ไม่มีอะไรเปลี่ยน
 *  - 🪙 เหรียญ → ไอคอนเหรียญ SVG ในตัว (วาดเอง ไม่พึ่งฟอนต์)
 *  - อีโมจิใหม่อื่น ๆ → อีโมจิรุ่นเก่าที่ทุกเครื่องมี (ตาราง MAP ด้านล่าง)
 * ครอบทั้งข้อความใน DOM (รวมที่สคริปต์เขียนทีหลัง ผ่าน MutationObserver) และข้อความที่วาดลง canvas (fillText/strokeText)
 * ทดสอบ/บังคับใช้: ตั้ง window.__EMO_FORCE = true (ก่อนโหลดไฟล์นี้) เพื่อจำลองเครื่องที่ไม่รองรับ
 */
(function () {
  "use strict";
  var MAP = { "\u{1FA99}": "\u{1F7E1}", "\u{1F972}": "\u{1F605}", "\u{1F977}": "\u{1F576}", "\u{1FAA8}": "\u{1F5FF}", "\u{1FAB5}": "\u{1F332}", "\u{1FAAA}": "\u{1F194}",
    "\u{1FABD}": "\u{1F54A}", "\u{1F6DE}": "\u2699", "\u{1F6FC}": "\u{1F6F9}", "\u{1F9CB}": "\u{1F964}", "\u{1FA84}": "\u2728" };
  var COIN = "\u{1FA99}";
  var SVG = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='%23fff1b8'/><stop offset='.45' stop-color='%23f3c53c'/><stop offset='1' stop-color='%23b8862b'/></linearGradient></defs>" +
    "<circle cx='16' cy='16' r='14.5' fill='url(%23g)' stroke='%238a5f12' stroke-width='1.6'/><circle cx='16' cy='16' r='10.2' fill='none' stroke='%23b8862b' stroke-width='1.8'/>" +
    "<path d='M10.5 11.5q4.5-4.6 10-1.6' fill='none' stroke='%23fffbe6' stroke-width='1.8' stroke-linecap='round'/><path d='M16 11.5v9M13.4 13.2h4.1a2 2 0 010 4h-4.1m0 0h4.6a2 2 0 010 4h-4.6' fill='none' stroke='%238a5f12' stroke-width='1.5' stroke-linecap='round' opacity='.8'/></svg>";
  var cv, cx;
  try { cv = document.createElement("canvas"); cv.width = cv.height = 40; cx = cv.getContext("2d", { willReadFrequently: true }); } catch (e) { cx = null; }
  var FONT = '28px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';
  function sig(ch) {
    cx.clearRect(0, 0, 40, 40); cx.font = FONT; cx.textBaseline = "top"; cx.fillStyle = "#000"; cx.fillText(ch, 2, 2);
    var d = cx.getImageData(0, 0, 40, 40).data, s = "", n = 0, col = 0;
    for (var i = 0; i < d.length; i += 4) { if (d[i + 3] > 30) { n++; if (Math.abs(d[i] - d[i + 1]) > 20 || Math.abs(d[i + 1] - d[i + 2]) > 20) col++; } }
    for (var j = 0; j < d.length; j += 64) s += d[j + 3] > 30 ? "1" : "0";
    return { s: s, n: n, col: col };
  }
  var bad = {}, list = [], force = !!window.__EMO_FORCE;
  try {
    if (cx) {
      var ok = sig("\u{1F642}"), tofu = sig("\u{10FFFE}");           // 🙂 ต้องมีสี ไม่งั้นเครื่องนี้ไม่มีฟอนต์อีโมจิเลย → ไม่แตะอะไร (กันทำพัง)
      var control = ok.col > 20;
      Object.keys(MAP).forEach(function (ch) {
        var g = sig(ch), unsupported = g.n < 8 || g.s === tofu.s || (control && g.col === 0 && g.s === sig("\u25A1").s);
        if (force || (control && unsupported)) { bad[ch] = 1; list.push(ch); }
      });
    }
  } catch (e) { /* ตรวจไม่ได้ = ไม่ทำอะไร */ }
  window.EmoFix = { active: list.length > 0, unsupported: list, force: force };
  if (!list.length) return;

  var RX = new RegExp("[" + list.join("") + "]", "u"), RXG = new RegExp("[" + list.join("") + "]", "gu");
  function plain(t) { return t.replace(RXG, function (c) { return MAP[c]; }); }
  var st = document.createElement("style");
  st.textContent = ".emoCoin{display:inline-block;width:1.08em;height:1.08em;vertical-align:-.17em;background:url(\"data:image/svg+xml," + SVG + "\") center/contain no-repeat}";
  (document.head || document.documentElement).appendChild(st);

  // canvas: วาดข้อความด้วยตัวอักษรสำรอง
  ["fillText", "strokeText"].forEach(function (fn) {
    var o = CanvasRenderingContext2D.prototype[fn];
    CanvasRenderingContext2D.prototype[fn] = function (t) { var a = arguments; if (typeof t === "string" && RX.test(t)) { a = Array.prototype.slice.call(arguments); a[0] = plain(t); } return o.apply(this, a); };
  });

  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, TITLE: 1, OPTION: 1, INPUT: 1, NOSCRIPT: 1 };
  function fixText(n) {
    var v = n.nodeValue; if (!v || !RX.test(v)) return;
    var p = n.parentNode; if (!p || SKIP[p.nodeName]) { if (p && p.nodeName !== "SCRIPT" && p.nodeName !== "STYLE") n.nodeValue = plain(v); return; }
    if (!bad[COIN] || v.indexOf(COIN) < 0) { n.nodeValue = plain(v); return; }
    var parts = v.split(COIN), f = document.createDocumentFragment();
    parts.forEach(function (s, i) {
      if (s) f.appendChild(document.createTextNode(plain(s)));
      if (i < parts.length - 1) { var e = document.createElement("span"); e.className = "emoCoin"; e.setAttribute("role", "img"); e.setAttribute("aria-label", "เหรียญ"); f.appendChild(e); }
    });
    p.replaceChild(f, n);
  }
  function walk(node) {
    if (node.nodeType === 3) return fixText(node);
    if (node.nodeType !== 1 || node.nodeName === "SCRIPT" || node.nodeName === "STYLE") return;
    var w = document.createTreeWalker(node, 4, null), arr = [], t;
    while ((t = w.nextNode())) if (RX.test(t.nodeValue)) arr.push(t);
    arr.forEach(fixText);
  }
  var obs = new MutationObserver(function (ms) {
    for (var i = 0; i < ms.length; i++) {
      var m = ms[i];
      if (m.type === "characterData") fixText(m.target);
      else for (var k = 0; k < m.addedNodes.length; k++) walk(m.addedNodes[k]);
    }
  });
  obs.observe(document, { childList: true, subtree: true, characterData: true });
  document.addEventListener("DOMContentLoaded", function () { walk(document.body); });
})();
