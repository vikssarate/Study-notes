// sw.js — Study-notes offline cache
const CACHE = 'study-notes-v1';

// IMPORTANT: these paths are RELATIVE to the repo root where index.html lives
// and your site is served at https://<user>.github.io/Study-notes/
const ASSETS = [
  './',                   // app shell
  './index.html',         // app shell
  './lib/sqlite/sqlite3.js',
  './lib/sqlite/sqlite3.wasm',
  './lib/sqlite/sqlite3-opfs-async-proxy.js'
];

self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k === CACHE ? null : caches.delete(k))))
    )
  );
  self.clients.claim();
});

// Cache-first for our assets; network-first (with offline fallback) for navigation
self.addEventListener('fetch', (evt) => {
  const req = evt.request;

  // Only handle GET requests inside our scope
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // App shell fallback for navigations
  if (req.mode === 'navigate') {
    evt.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Cache-first for static assets
  evt.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const resClone = res.clone();
      // Store in cache if response is OK
      if (res.status === 200) {
        caches.open(CACHE).then((c) => c.put(req, resClone));
      }
      return res;
    }).catch(() => hit)) // if network fails and no hit, just fall through
  );
});
