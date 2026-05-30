const CACHE_NAME = 'elite-coach-cache-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/logo.png',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Intercept only HTTP/HTTPS requests (ignore chrome-extension://, etc.)
  if (!request.url.startsWith('http:') && !request.url.startsWith('https:')) {
    return;
  }

  // Intercept only GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Exclude Supabase and local API routes from caching
  if (url.pathname.startsWith('/api/') || request.url.includes('supabase.co') || url.pathname.includes('/api/')) {
    return;
  }

  // Network-First with cache fallback strategy
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // Cache successful responses for system assets and static files
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(request, { ignoreSearch: true }).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If navigation request, return cached root '/' shell
          if (request.mode === 'navigate') {
            return caches.match('/', { ignoreSearch: true });
          }
          return Promise.reject('offline');
        });
      })
  );
});
