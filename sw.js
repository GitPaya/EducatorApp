const CACHE_NAME = 'educator-v8-cache-v1'; // Подняли версию кэша!
const assetsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './database.js',
  './manifest.json',
  './icon.png'
];

// Установка Service Worker и принудительный перехват
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Сразу активируем новый воркер без ожидания
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(assetsToCache);
    })
  );
});

// Активация и очистка старых кэшей
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Сетевой запрос с fallback на кэш (сначала сеть, при офлайне — кэш)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Если сеть доступна, обновляем кэш на лету
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, response.clone());
          return response;
        });
      })
      .catch(() => {
        // Если нет интернета, отдаем из кэша
        return caches.match(event.request);
      })
  );
});