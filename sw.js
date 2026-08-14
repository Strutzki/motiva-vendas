/* Motiva Vendas — Service Worker (offline + push) */
const CACHE = "motiva-vendas-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./supabase.js",
  "./591.supabase.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
  "./favicon-32.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* Estratégia: network-first para o HTML (pega atualizações),
   cache-first para os demais arquivos (rápido e offline). */
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const isHTML = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
  if (isHTML) {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put("./index.html", copy));
        return res;
      }).catch(() => caches.match("./index.html").then((r) => r || caches.match("./")))
    );
  } else {
    e.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => cached))
    );
  }
});

/* ===== Push: mostra a notificação ===== */
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = {}; }
  const title = d.title || "Motiva Vendas 💪";
  const opts = {
    body: d.body || "Sua dose diária de motivação chegou!",
    icon: "./icon-192.png",
    badge: "./favicon-32.png",
    tag: "motiva-daily",
    renotify: true,
    data: { url: d.url || "https://motivavendas.com.br" }
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});

/* ===== Clique: abre/foca o app ===== */
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "https://motivavendas.com.br";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) { try { c.navigate(url); } catch (_) {} return c.focus(); }
      }
      return self.clients.openWindow(url);
    })
  );
});
