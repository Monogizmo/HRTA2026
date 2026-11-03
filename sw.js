// HRTA Offsite - service worker
// เปลี่ยนเลขเวอร์ชันนี้ทุกครั้งที่แก้ไฟล์ เพื่อบังคับให้เครื่องผู้ใช้โหลดของใหม่
const VERSION = "v29";
const CACHE = "hrta-offsite-" + VERSION;
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png",
  "online/online.css", "online/config.js", "online/nn-engine.js", "online/online-game.js", "online/online.js",
  // รูปที่แยกออกจาก index.html (v26) เก็บไว้ใช้ออฟไลน์เหมือนเดิม
  "img/01-de66637f.jpg",
  "img/02-a13e26d2.jpg",
  "img/03-21751056.jpg",
  "img/04-26292e00.jpg",
  "img/05-ca9a154f.jpg",
  "img/06-56ef9151.jpg",
  "img/07-47c0a45c.jpg",
  "img/08-7b079276.jpg",
  "img/09-9087c7d6.jpg",
  "img/10-4a36b655.jpg",
  "img/11-d3d30171.jpg",
  "img/12-c208595e.jpg",
  "img/13-dfeee269.jpg",
  "img/14-26401706.jpg",
  "img/15-f63b35ae.jpg",
  "img/16-79749a7b.jpg",
  "img/17-c3d68afe.jpg",
  "img/18-12dcbf96.jpg",
  "img/19-0b018d90.jpg",
  "img/20-d4da113c.jpg",
  "img/21-44d6f3e4.jpg",
  "img/22-58dbb514.jpg",
  "img/23-29c23f22.jpg",
  "img/24-d5c769f0.jpg",
  "img/25-7475e88f.jpg",
  "img/26-3a135d21.jpg",
  "img/27-6c0f1eae.jpg",
  "img/28-aa529a23.jpg",
  "img/29-e978450b.jpg",
  "img/30-65f30749.jpg",
  "img/31-d810a579.jpg",
  "img/32-932e340a.jpg",
  "img/33-b1136f43.jpg",
  "img/34-12263f8d.jpg",
  "img/35-b4cb43cd.jpg",
  "img/36-3bc0ad81.jpg",
  "img/37-5e459b78.jpg",
  "img/38-4ae3ddcf.jpg",
  "img/39-442369b1.jpg",
  "img/40-a15e6f79.jpg",
  "img/41-24fc7403.jpg",
  "img/42-87784f91.jpg",
  "img/43-aad150dd.jpg",
  "img/44-96d2fe9d.jpg",
  "img/45-f321de6d.jpg",
  "img/46-129072b7.jpg",
  "img/47-defd9456.jpg",
  "img/48-f587e48c.jpg"];
// เว็บภายนอกที่ "จำไว้ใช้ออฟไลน์" (ไลบรารีแผนที่ + ฟอนต์) ส่วนแผนที่ดาวเทียม/เส้นทางไม่เก็บ
const KEEP_HOSTS = ["cdnjs.cloudflare.com", "cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // หน้าเว็บหลัก: ลองโหลดจากเน็ตก่อน (จะได้เห็นของใหม่เสมอ) ถ้าไม่มีเน็ตค่อยใช้ที่จำไว้
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put("index.html", copy));
        return res;
      }).catch(() => caches.match("index.html"))
    );
    return;
  }

  // ไฟล์ของเราเอง + ไลบรารี/ฟอนต์: ใช้ที่จำไว้ก่อน แล้วอัปเดตเบื้องหลัง
  if (url.origin === self.location.origin || KEEP_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.match(req).then((hit) => {
        const net = fetch(req).then((res) => {
          if (res && (res.ok || res.type === "opaque")) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    );
  }
});
