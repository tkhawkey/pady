/* PÁDY service worker: works offline after the first visit.
   App files: served from cache, refreshed in the background (so updates arrive on the next open).
   lookup-data.js and fonts: cached the first time they are used.
   Wiktionary tables (Hľadaj): network first, cached copy when offline. */
const CACHE = 'pady-v13';
const CORE = [
  './', 'index.html', 'style.css', 'app.js', 'engine.js', 'learn.js', 'lookup.js', 'trainer.js', 'ulovok.js', 'data.js',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('wiktionary.org')) {
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })
      .catch(() => caches.match(req)));
    return;
  }
  // stale-while-revalidate for the app itself and fonts
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(req, { ignoreSearch: url.origin === location.origin });
    const net = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
