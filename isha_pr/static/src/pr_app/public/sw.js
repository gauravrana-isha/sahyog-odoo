// Vaani PWA Service Worker — cache-first for static assets, network-first
// for navigation; API calls always hit the network.
const CACHE_NAME = 'vaani-v1';
const STATIC_ASSETS = [
  '/pr/app',
  '/isha_pr/static/pwa/icon-192.png',
  '/isha_pr/static/pwa/icon-512.png',
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

  // Skip non-GET, API and backend calls
  if (event.request.method !== 'GET') return;
  if (url.pathname.startsWith('/pr/api/')) return;
  if (url.pathname.startsWith('/web/')) return;
  if (url.pathname.startsWith('/odoo')) return;

  // Navigations: network first, offline fallback to the app shell
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/pr/app'))
    );
    return;
  }

  // Static assets: cache first
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
  }
});
