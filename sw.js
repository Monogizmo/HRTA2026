// HRTA Offsite - service worker
// เปลี่ยนเลขเวอร์ชันนี้ทุกครั้งที่แก้ไฟล์ เพื่อบังคับให้เครื่องผู้ใช้โหลดของใหม่
const VERSION = "v1";
const CACHE = "hrta-offsite-" + VERSION;
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];
// เว็บภายนอกที่ "จำไว้ใช้ออฟไลน์" (ไลบรารีแผนที่ + ฟอนต์) ส่วนแผนที่ดาวเทียม/เส้นทางไม่เก็บ
const KEEP_HOSTS = ["cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com"];

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
