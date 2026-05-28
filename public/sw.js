const CACHE_NAME = 'elite-coach-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  'https://i.ibb.co/Ld1WcP1t/NEW-LOGO-JAIRA-LEAL.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
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
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Apenas intercepta requisições HTTP/HTTPS (ignora chrome-extension://, etc.)
  if (!event.request.url.startsWith('http:') && !event.request.url.startsWith('https:')) {
    return;
  }

  // Verifica se a requisição é de um dos ativos estáticos definidos no ASSETS_TO_CACHE
  const requestUrl = new URL(event.request.url);
  const isCacheableAsset = ASSETS_TO_CACHE.some((asset) => {
    if (asset === '/') {
      return requestUrl.pathname === '/';
    }
    return requestUrl.pathname.endsWith(asset) || event.request.url.includes(asset);
  });

  // Se não for um ativo estático do PWA (como treinos, chunks do Next.js, webpack, etc.), carrega direto da rede
  if (!isCacheableAsset) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Retorna o cache se encontrar, caso contrário busca na rede
      return cachedResponse || fetch(event.request);
    })
  );
});
