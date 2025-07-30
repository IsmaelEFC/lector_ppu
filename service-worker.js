self.addEventListener('install', e => {
    e.waitUntil(
      caches.open('ocr-ppu-cache').then(cache => {
        return cache.addAll([
          './',
          './index.html',
          './main.js',
          './ocr.js',
          './charset.js',
          './manifest.json',
          './assets/icon.png'
        ]);
      })
    );
  });
  
  self.addEventListener('fetch', e => {
    e.respondWith(
      caches.match(e.request).then(response => response || fetch(e.request))
    );
  });
  