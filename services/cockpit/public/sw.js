// Fusion247 Cockpit service worker — makes it an installable app (home-screen icon, fullscreen,
// offline shell). Shell is cache-first; live data (/api/*) is always network-first so the cockpit
// never shows stale attention/outputs — it just fails soft when off the tailnet.
//
// ╔═══════════════════════════════════════════════════════════════════════════════════════════════╗
// ║ THE BYTES YOU ARE READING ARE NOT THE BYTES THE BROWSER RECEIVES — AND THAT IS DELIBERATE.     ║
// ║                                                                                               ║
// ║ `__SHELL_HASH__` below is a PLACEHOLDER. When this file is served over HTTP, the cockpit's     ║
// ║ static handler replaces it with a hash of the actual shell content (services/cockpit/          ║
// ║ sw-version.mjs). So the cache name changes by itself whenever a shell file changes, and stays  ║
// ║ put when nothing changes.                                                                     ║
// ║                                                                                               ║
// ║ If you are diffing served-vs-disk and see a difference here: THE SERVER IS NOT CORRUPTING      ║
// ║ YOUR ASSETS. `/sw.js` is the ONLY transformed response; every other static file is served      ║
// ║ byte-for-byte off disk.                                                                       ║
// ║                                                                                               ║
// ║ DO NOT replace the placeholder with a version literal. It used to be one (`f247-cockpit-v25`)  ║
// ║ and the rule was "remember to bump it on every shell change" — a habit, not a control, and     ║
// ║ its failure is silent: the device keeps serving the old bundle and the change simply appears   ║
// ║ never to have happened. A CI check (services/cockpit/sw-version-check.mjs) now fails if a      ║
// ║ hand-typed literal comes back.                                                                ║
// ╚═══════════════════════════════════════════════════════════════════════════════════════════════╝
const CACHE = 'f247-cockpit-__SHELL_HASH__';
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
