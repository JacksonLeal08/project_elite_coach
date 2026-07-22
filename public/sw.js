const CACHE_NAME = 'elite-coach-cache-v4';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/logo.png',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.png',
  '/gym-bg.png'
];

// 1. Instalação: Pré-carregar recursos essenciais no cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Pré-carregando App Shell no cache');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 2. Ativação: Limpar caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Interceptação de Requisições (Fetch)
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Interceptar apenas requisições HTTP/HTTPS
  if (!request.url.startsWith('http:') && !request.url.startsWith('https:')) {
    return;
  }

  // Interceptar apenas requisições GET
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Ignorar rotas de API em tempo real (Supabase e endpoints internos /api/)
  if (
    url.pathname.startsWith('/api/') || 
    request.url.includes('supabase.co') || 
    request.url.includes('realtime')
  ) {
    return;
  }

  // Estratégia Stale-While-Revalidate com Fallback Offline para Navegação
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cachedResponse) => {
      // Buscar versão atualizada em segundo plano
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch((err) => {
          console.log('[ServiceWorker] Sem conexão de rede para:', request.url);
          // Se for uma navegação de página HTML e não houver resposta em cache direta, entregar a raiz '/'
          if (request.mode === 'navigate') {
            return caches.match('/', { ignoreSearch: true });
          }
          return null;
        });

      // Retornar do cache imediatamente se existir (Stale), ou aguardar a rede
      return cachedResponse || fetchPromise;
    })
  );
});
