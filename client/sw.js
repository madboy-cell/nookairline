// client/sw.js — cache-first for immutable vendor bundles, network-first for game code & art so re-sliced sprites land immediately.
const VERSION = 'neora-v2-moon-sanctuary-v21';
const CACHE_FIRST = [/^\/vendor\//];

self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(VERSION)); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname === '/ws') return;
  if (CACHE_FIRST.some((re) => re.test(url.pathname))) {
    e.respondWith(caches.open(VERSION).then(async (c) => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) c.put(e.request, res.clone());
      return res;
    }));
    return;
  }
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then((res) => {
    if (res.ok) caches.open(VERSION).then((c) => c.put(e.request, res.clone()));
    return res;
  }).catch(() => caches.match(e.request)));
});
