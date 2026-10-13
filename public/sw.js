// Sky Party PWA Service Worker (v1.0.2)
const CACHE_NAME = 'sky-party-cache-v3';
const CORE_ASSETS = [
  './',
  './index.html',
  './favicon.png',
  './assets/ui/crest.png',
  './assets/ui/sky_party_crest.png',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS).catch((err) => {
        console.warn('[SkyPWA-SW] Core cache warming partial fail:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => {
        return Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        );
      })
    ])
  );
});

// Network-first fetch handler for maximum real-time multiplayer freshness
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Bypass non-GET, WebSockets, or external third-party requests
  if (req.method !== 'GET' || url.protocol === 'ws:' || url.protocol === 'wss:' || url.origin !== self.location.origin) {
    return;
  }

  // Network-first strategy with cache fallback
  event.respondWith(
    fetch(req).catch(() => {
      return caches.match(req).then((cached) => {
        return cached || new Response('Network unavailable', { status: 503, statusText: 'Service Unavailable' });
      });
    })
  );
});
