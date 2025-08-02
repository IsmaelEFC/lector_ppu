const CACHE_NAME = 'patentes-chile-v1.0.4';
const urlsToCache = [
  '/',
  '/index.html',
  '/main.js',
  '/ocr.js',
  '/utils.js',
  '/charset.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js',
  'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort-wasm.wasm',
  'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort-wasm-simd.wasm'
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Cache abierto');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[Service Worker] Recursos cacheados correctamente');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[Service Worker] Error durante la instalación:', error);
      })
  );
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activando...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Eliminando cache antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Activado y listo');
      return self.clients.claim();
    })
  );
});

// Estrategia de fetch: Cache First para recursos estáticos, Network First para datos dinámicos
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Solo manejar requests HTTP/HTTPS
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // Network First para API calls y páginas dinámicas
  if (requestUrl.hostname === 'www.autoseguro.gob.cl' ||
      requestUrl.pathname.includes('api') ||
      event.request.method !== 'GET') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Si la respuesta es válida, la clonamos y guardamos en cache
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache First para recursos estáticos
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Intentar actualizar el caché en segundo plano
        const fetchPromise = fetch(event.request).then((response) => {
          // Verificar si la respuesta es válida
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clonar la respuesta para el caché
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        });

        // Devolver la respuesta en caché si existe, si no, la de la red
        return cachedResponse || fetchPromise;
      })
      .catch((error) => {
        console.error('[Service Worker] Error en fetch:', error);
        
        // Página offline personalizada para solicitudes HTML
        if (event.request.headers.get('accept').includes('text/html')) {
          return new Response(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Sin conexión</title>
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                body {
                  font-family: Arial, sans-serif;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  height: 100vh;
                  margin: 0;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  color: white;
                  text-align: center;
                }
                .container {
                  padding: 20px;
                  border-radius: 10px;
                  background: rgba(255, 255, 255, 0.1);
                  max-width: 90%;
                }
                h1 { margin-bottom: 20px; }
                p { margin-bottom: 20px; }
                button {
                  background: #00ff88;
                  color: white;
                  border: none;
                  padding: 12px 24px;
                  border-radius: 25px;
                  font-size: 16px;
                  cursor: pointer;
                  transition: all 0.3s ease;
                }
                button:hover {
                  background: #00cc6a;
                  transform: translateY(-2px);
                  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>📵 Sin conexión</h1>
                <p>No tienes conexión a internet. La aplicación necesita conexión para funcionar correctamente.</p>
                <button onclick="window.location.reload()">🔄 Reintentar conexión</button>
              </div>
              <script>
                // Verificar conexión periódicamente
                setInterval(() => {
                  fetch('/').then(() => window.location.reload()).catch(() => {});
                }, 10000);
              </script>
            </body>
            </html>
          `, { 
            headers: { 'Content-Type': 'text/html; charset=utf-8' } 
          });
        }
        
        return new Response('Sin conexión', { 
          status: 503, 
          statusText: 'Sin conexión',
          headers: { 'Content-Type': 'text/plain' }
        });
      })
  );
});

// Manejar mensajes desde la aplicación principal
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

// Manejar notificaciones push
self.addEventListener('push', (event) => {
  if (event.data) {
    const options = {
      body: event.data.text(),
      icon: '/icon-192.png',
      badge: '/icon-96.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: '1'
      },
      actions: [
        {
          action: 'explore',
          title: 'Abrir app',
          icon: '/icon-192.png'
        },
        {
          action: 'close',
          title: 'Cerrar',
          icon: '/icon-192.png'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification('Detector de Patentes', options)
    );
  }
});

// Manejar clicks en notificaciones
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});