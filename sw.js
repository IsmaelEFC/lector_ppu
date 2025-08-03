// Service Worker for PWA Detector de Patentes Chile
const CACHE_NAME = 'patentes-chile-v1.1.0';
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// Resources to cache immediately
const CORE_RESOURCES = [
  './',
  './index.html',
  './main.js',  
  './utils.js',
  './manifest.json'
];

// Resources to cache on first use
const EXTENDED_RESOURCES = [
  './icons/icon-16x16.png',
  './icons/icon-32x32.png',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'
];

// Create offline fallback page
const OFFLINE_PAGE = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sin conexión - Detector de Patentes</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-align: center;
      padding: 20px;
    }
    .container {
      max-width: 400px;
      padding: 40px 30px;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    }
    h1 {
      font-size: 2.5rem;
      margin-bottom: 20px;
    }
    h2 {
      font-size: 1.5rem;
      margin-bottom: 15px;
      opacity: 0.9;
    }
    p {
      margin-bottom: 25px;
      opacity: 0.8;
      line-height: 1.5;
    }
    button {
      background: linear-gradient(45deg, #00ff88, #00cc6a);
      color: white;
      border: none;
      padding: 15px 30px;
      border-radius: 25px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      margin: 10px;
      box-shadow: 0 4px 15px rgba(0, 255, 136, 0.3);
    }
    button:hover {
      background: linear-gradient(45deg, #00cc6a, #00aa55);
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 255, 136, 0.4);
    }
    .status {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: bold;
      background: rgba(255, 68, 68, 0.9);
    }
    .features {
      margin-top: 30px;
      text-align: left;
    }
    .feature {
      display: flex;
      align-items: center;
      margin: 10px 0;
      opacity: 0.7;
    }
    .feature-icon {
      margin-right: 10px;
      font-size: 1.2rem;
    }
    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.5; }
      100% { opacity: 1; }
    }
    .checking {
      animation: pulse 2s infinite;
    }
  </style>
</head>
<body>
  <div class="status" id="status">📵 Sin conexión</div>
  
  <div class="container">
    <h1>📵</h1>
    <h2>Sin conexión a internet</h2>
    <p>La aplicación necesita una conexión a internet para funcionar correctamente. Verificando conexión automáticamente...</p>
    
    <button onclick="checkConnection()" id="retryBtn">
      🔄 Verificar conexión
    </button>
    
    <div class="features">
      <h3 style="margin-bottom: 15px;">Características de la app:</h3>
      <div class="feature">
        <span class="feature-icon">📷</span>
        <span>Detección de placas con cámara</span>
      </div>
      <div class="feature">
        <span class="feature-icon">🤖</span>
        <span>OCR avanzado con IA</span>
      </div>
      <div class="feature">
        <span class="feature-icon">🔍</span>
        <span>Consulta directa en AutoSeguro</span>
      </div>
      <div class="feature">
        <span class="feature-icon">📱</span>
        <span>Aplicación web progresiva</span>
      </div>
    </div>
  </div>

  <script>
    let checkInterval;
    
    function updateStatus(isOnline) {
      const status = document.getElementById('status');
      const retryBtn = document.getElementById('retryBtn');
      
      if (isOnline) {
        status.textContent = '🌐 Conectado';
        status.style.background = 'rgba(0, 255, 136, 0.9)';
        retryBtn.textContent = '✅ Recargar página';
        retryBtn.onclick = () => window.location.reload();
      } else {
        status.textContent = '📵 Sin conexión';
        status.style.background = 'rgba(255, 68, 68, 0.9)';
        retryBtn.classList.add('checking');
      }
    }
    
    async function checkConnection() {
      const retryBtn = document.getElementById('retryBtn');
      retryBtn.textContent = '🔄 Verificando...';
      retryBtn.classList.add('checking');
      
      try {
        const response = await fetch('./', { 
          method: 'HEAD',
          cache: 'no-cache'
        });
        
        if (response.ok) {
          updateStatus(true);
          setTimeout(() => window.location.reload(), 1000);
          return;
        }
      } catch (error) {
        console.log('Still offline');
      }
      
      retryBtn.textContent = '🔄 Verificar conexión';
      retryBtn.classList.remove('checking');
      updateStatus(false);
    }
    
    // Check connection every 10 seconds
    checkInterval = setInterval(checkConnection, 10000);
    
    // Initial check
    checkConnection();
    
    // Listen for online events
    window.addEventListener('online', () => {
      updateStatus(true);
      setTimeout(() => window.location.reload(), 500);
    });
    
    window.addEventListener('offline', () => {
      updateStatus(false);
    });
  </script>
</body>
</html>`;

// Service Worker installation
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        
        // Cache offline page first
        await cache.put(
          './offline.html', 
          new Response(OFFLINE_PAGE, {
            headers: { 
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'max-age=86400'
            }
          })
        );
        
        // Cache core resources
        console.log('[SW] Caching core resources...');
        await cache.addAll(CORE_RESOURCES);
        
        // Try to cache extended resources (non-critical)
        for (const url of EXTENDED_RESOURCES) {
          try {
            await cache.add(url);
          } catch (error) {
            console.warn(`[SW] Failed to cache ${url}:`, error);
          }
        }
        
        console.log('[SW] Installation complete');
        
        // Skip waiting to activate immediately
        await self.skipWaiting();
        
      } catch (error) {
        console.error('[SW] Installation failed:', error);
        throw error;
      }
    })()
  );
});

// Service Worker activation
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    (async () => {
      try {
        // Clean up old caches
        const cacheNames = await caches.keys();
        const oldCaches = cacheNames.filter(name => 
          name.startsWith('patentes-chile-') && name !== CACHE_NAME
        );
        
        await Promise.all(
          oldCaches.map(cacheName => {
            console.log(`[SW] Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          })
        );
        
        // Take control of all clients
        await self.clients.claim();
        
        console.log('[SW] Activation complete');
        
      } catch (error) {
        console.error('[SW] Activation failed:', error);
      }
    })()
  );
});

// Cache size management
async function manageCacheSize(cacheName, maxSize) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    
    let totalSize = 0;
    const sizePromises = keys.map(async (request) => {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        return { request, size: blob.size };
      }
      return { request, size: 0 };
    });
    
    const sizes = await Promise.all(sizePromises);
    sizes.sort((a, b) => b.size - a.size); // Sort by size, largest first
    
    for (const { request, size } of sizes) {
      totalSize += size;
      if (totalSize > maxSize) {
        await cache.delete(request);
        console.log(`[SW] Deleted ${request.url} (${size} bytes) to free space`);
      }
    }
    
  } catch (error) {
    console.error('[SW] Cache size management failed:', error);
  }
}

// Fetch event handler with improved caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  const isGetRequest = request.method === 'GET';
  const isSameOrigin = url.origin === self.location.origin;
  const isApiRequest = url.pathname.startsWith('/api/');
  const isStaticAsset = CORE_RESOURCES.includes(url.pathname) || 
                      EXTENDED_RESOURCES.some(asset => url.pathname.endsWith(asset));

  // Skip non-GET requests and cross-origin requests that aren't for static assets
  if (!isGetRequest || (!isSameOrigin && !isStaticAsset)) {
    return;
  }

  // For API requests, try network first, then cache
  if (isApiRequest) {
    event.respondWith(
      (async () => {
        try {
          // Try network first
          const networkResponse = await fetch(request);
          
          // If successful, cache the response
          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          // Network failed, try cache
          console.log('[SW] Network failed, trying cache for:', request.url);
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // If no cache, return offline page for HTML requests
          if (request.headers.get('accept').includes('text/html')) {
            return caches.match('./offline.html');
          }
          throw error;
        }
      })()
    );
    return;
  }

  // For static assets, try cache first, then network
  event.respondWith(
    (async () => {
      try {
        // Try cache first
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          // Update cache in the background
          event.waitUntil(
            (async () => {
              try {
                const response = await fetch(request);
                if (response && response.status === 200) {
                  const cache = await caches.open(CACHE_NAME);
                  await cache.put(request, response);
                }
              } catch (error) {
                console.log('[SW] Background update failed for:', request.url);
              }
            })()
          );
          return cachedResponse;
        }

        // Not in cache, try network
        const networkResponse = await fetch(request);
        
        // Cache the response if it's valid
        if (networkResponse && networkResponse.status === 200) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, networkResponse.clone());
          
          // Manage cache size after adding new content
          await manageCacheSize(CACHE_NAME, MAX_CACHE_SIZE);
        }
        
        return networkResponse;
      } catch (error) {
        console.error('[SW] Fetch failed:', error);
        
        // If it's a page request, return the offline page
        if (request.headers.get('accept').includes('text/html')) {
          return caches.match('./offline.html');
        }
        
        // For other requests, return a fallback response
        return new Response('No internet connection', {
          status: 408,
          statusText: 'No internet connection',
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    })()
  );
});

// Listen for messages from the page
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      console.log('[SW] Cache cleared');
      event.ports[0].postMessage({ success: true });
    }).catch(error => {
      console.error('[SW] Failed to clear cache:', error);
      event.ports[0].postMessage({ success: false, error: error.message });
    });
  }
});

// Handle push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  const title = data.title || 'Nueva notificación';
  const options = {
    body: data.body,
    icon: './icons/icon-192x192.png',
    badge: './icons/icon-192x192.png',
    data: data.data || {},
    vibrate: [100, 50, 100],
    actions: data.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const urlToOpen = event.notification.data.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});