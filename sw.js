/**
 * Service Worker - الصقري للاتصالات
 * تخزين مؤقت بسيط لتحميل أسرع وتجربة PWA
 */
const CACHE_NAME = 'alsaqri-pwa-v1';
var urlsToCache = [
  '/',
  '/index.html',
  '/login.html',
  '/dashboard.html',
  '/css/app-mobile.css'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(urlsToCache); })
      .catch(function () {})
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames.filter(function (name) { return name !== CACHE_NAME; })
          .map(function (name) { return caches.delete(name); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request)
      .then(function (response) {
        if (response) return response;
        return fetch(event.request).then(function (res) {
          if (!res || res.status !== 200 || res.type !== 'basic') return res;
          var clone = res.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, clone);
          });
          return res;
        });
      })
  );
});
