// Fusion247 Cockpit service worker — makes it an installable app (home-screen icon, fullscreen,
// offline shell). Shell is cache-first; live data (/api/*) is always network-first so the cockpit
// never shows stale attention/outputs — it just fails soft when off the tailnet.
const CACHE = 'f247-cockpit-v7';
const SHELL = ['/', '/index.html', '/app.js', '/styles.css', '/vendor/vue.global.prod.js', '/manifest.webmanifest', '/icon.svg'];

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
