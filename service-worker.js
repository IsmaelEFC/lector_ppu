const CACHE_NAME = 'ppu-lector-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/main.js',
  '/ocr.js',
  '/charset.js',
  '/manifest.json',
  'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort-wasm-simd.wasm',
  'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort-wasm.wasm',
  'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort-wasm-simd.jsep.wasm',
  'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort-wasm.jsep.wasm',
  'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js',
  'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort-wasm-simd.worker.js',
  'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort-wasm.worker.js',
  'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort-wasm-simd-threaded.worker.js',
  'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort-wasm-threaded.worker.js'
];

// Install event - cache all static assets
self.addEventListener('install', event => {
  console.log('Service Worker installing.');
  
  // Skip waiting to activate the new service worker immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching app shell and other assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .catch(error => {
        console.error('Cache addAll error:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker activating.');
  
  // Remove old caches
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  
  // Take control of all clients immediately
  return self.clients.claim();
});

// Fetch event - serve from cache, falling back to network
self.addEventListener('fetch', event => {
  // Skip cross-origin requests, like those for Google Analytics
  if (!event.request.url.startsWith(self.location.origin) && 
      !event.request.url.startsWith('https://cdn.jsdelivr.net/')) {
    return;
  }

  // For API requests, try network first, then cache
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // If the response is good, clone it and store it in the cache
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, responseToCache));
          return response;
        })
        .catch(() => {
          // If network fails, try to get it from the cache
          return caches.match(event.request);
        })
    );
  } else {
    // For all other requests, try cache first, then network
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          // Return cached response if found
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // Otherwise, fetch from network and cache the response
          return fetch(event.request)
            .then(response => {
              // Check if we received a valid response
              if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }
              
              // Clone the response
              const responseToCache = response.clone();
              
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                });
                
              return response;
            });
        })
    );
  }
});

// Listen for messages from the main thread
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});