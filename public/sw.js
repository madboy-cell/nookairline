// Sky Party PWA Service Worker (v1.2.0)
const CACHE_NAME = 'sky-party-cache-v5';
const ASSET_CACHE_NAME = 'sky-party-assets-v5';
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
  const validCaches = new Set([CACHE_NAME, ASSET_CACHE_NAME]);
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => {
        return Promise.all(
          keys.filter((key) => !validCaches.has(key)).map((key) => caches.delete(key))
        );
      })
    ])
  );
});

// Stale-while-revalidate for static assets/vendor, Network-first for HTML/JS/CSS
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Bypass non-GET, WebSockets, or external third-party requests
  if (req.method !== 'GET' || url.protocol === 'ws:' || url.protocol === 'wss:' || url.origin !== self.location.origin) {
    return;
  }

  const isStaticAsset = url.pathname.includes('/assets/') || url.pathname.includes('/vendor/');
  if (isStaticAsset) {
    event.respondWith(
      caches.open(ASSET_CACHE_NAME).then((cache) => {
        return cache.match(req).then((cached) => {
          const networkFetch = fetch(req)
            .then((res) => {
              if (res && res.status === 200) {
                cache.put(req, res.clone()).catch(() => {});
              }
              return res;
            })
            .catch(() => cached);
          return cached || networkFetch;
        });
      })
    );
    return;
  }

  // Network-first strategy with cache fallback for HTML/JS/CSS
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200) {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone)).catch(() => {});
        }
        return res;
      })
      .catch(() => {
        return caches.match(req).then((cached) => {
          return cached || new Response('Network unavailable', { status: 503, statusText: 'Service Unavailable' });
        });
      })
  );
});

