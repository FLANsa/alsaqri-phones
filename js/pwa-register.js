/**
 * تسجيل Service Worker - الصقري للاتصالات PWA
 *
 * التحديث تلقائي: sw.js ينفّذ skipWaiting() عند التثبيت، وعند تغيّر
 * الـ controller تعاد تحميل الصفحة. لا حاجة لحوار تأكيد — الرسائل
 * المرسلة سابقاً (SKIP_WAITING) لم يكن يعالجها sw.js أصلاً.
 */
(function () {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .catch(function () {});
  });

  navigator.serviceWorker.addEventListener('controllerchange', function () {
    window.location.reload();
  });
})();
