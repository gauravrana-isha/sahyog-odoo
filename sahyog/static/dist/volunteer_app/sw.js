// Sahyog PWA Service Worker — cache-first for static assets, network-first for API
const CACHE_NAME = 'sahyog-v1';
const STATIC_ASSETS = [
  '/sahyog/app',
  '/sahyog/static/pwa/icon-192.png',
  '/sahyog/static/pwa/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET and API calls
  if (event.request.method !== 'GET') return;
  if (url.pathname.startsWith('/sahyog/api/')) return;
  if (url.pathname.startsWith('/web/')) return;

  // For navigation requests, try network first then cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/sahyog/app'))
    );
    return;
  }

  // For static assets, cache first
  if (url.pathname.includes('/static/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }
});
