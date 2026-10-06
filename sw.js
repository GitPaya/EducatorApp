const CACHE_NAME = 'educator-v8-cache-v2';
const urlsToCache = [
  './index.html',
  './style.css',
  './app.js',
  './database.js'
];

// Установка воркера и кэширование файлов
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Отдача файлов из кэша, если нет сети
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});