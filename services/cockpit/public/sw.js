// Fusion247 Cockpit service worker — makes it an installable app (home-screen icon, fullscreen,
// offline shell). Shell is cache-first; live data (/api/*) is always network-first so the cockpit
// never shows stale attention/outputs — it just fails soft when off the tailnet.
// v24: app.js + styles.css changed (real AsdAIr Overview/Details views). The shell is cache-first, so
// an installed PWA keeps serving the old bundle until this string moves — a correct edit that never
// reaches the device is indistinguishable from no edit at all. Bump it with every shell change.
const CACHE = 'f247-cockpit-v24';
// '/private-apps.js' is DELIBERATELY absent. It is the optional local overlay and must never be
// baked into a device's cache; it is served no-store and re-fetched every load. Off the tailnet the
// script simply fails to load and the overlay's surface fails CLOSED, which is the right direction.
const SHELL = ['/', '/index.html', '/apps.js', '/app.js', '/styles.css', '/vendor/vue.global.prod.js', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) { e.respondWith(fetch(e.request).catch(() => caches.match(e.request))); return; }
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
