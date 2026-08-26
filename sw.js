/**
 * Service Worker - الصقري للاتصالات
 * تخزين مؤقت بسيط لتحميل أسرع وتجربة PWA
 *
 * استراتيجية الكاش:
 * - HTML/JS/CSS (نفس الأصل): network-first — الشبكة أولًا حتى تصل التحديثات فورًا،
 *   والكاش احتياط عند انقطاع الاتصال فقط.
 * - الأصول الثابتة (أيقونات/خطوط/manifest): cache-first.
 * - أي طلب من مصادر خارجية (Firestore وغيرها): يمر مباشرة دون تدخل.
 * - ملاحظة نشر: عند أي تعديل على ملفات الموقع ارفع رقم CACHE_NAME (v2 → v3 ...)
 *   ليمسح المتصفح الكاش القديم فورًا.
 */
const CACHE_NAME = 'alsaqri-pwa-v6';
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

  var url = new URL(event.request.url);

  // الطلبات الخارجية (Firestore، CDN...) تمر دون أي تدخل من الكاش
  if (url.origin !== self.location.origin) return;

  var isStaticAsset = /\.(png|jpg|jpeg|svg|ico|webp|woff2?|manifest)$/i.test(url.pathname);

  // الأيقونات والخطوط وmanifest: cache-first (لا تتغير)
  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then(function (response) {
        return response || fetch(event.request).then(function (res) {
          if (res && res.status === 200) {
            var clone = res.clone();
            caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, clone); });
          }
          return res;
        });
      })
    );
    return;
  }

  // صفحات HTML و JS و CSS: network-first — التحديثات تصل فورًا، والكاش للطوارئ فقط
  event.respondWith(
    fetch(event.request).then(function (res) {
      if (res && res.status === 200 && res.type === 'basic') {
        var clone = res.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, clone); });
      }
      return res;
    }).catch(function () {
      return caches.match(event.request).then(function (response) {
        return response || caches.match('/index.html');
      });
    })
  );
});
