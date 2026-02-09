/**
 * تسجيل Service Worker - الصقري للاتصالات PWA
 */
(function () {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(function (reg) {
        if (reg.installing) reg.installing.addEventListener('statechange', checkUpdate);
        else if (reg.waiting) checkUpdate({ target: reg.waiting });
        reg.addEventListener('updatefound', function () {
          reg.installing.addEventListener('statechange', checkUpdate);
        });
      })
      .catch(function () {});
  });

  function checkUpdate(e) {
    var sw = e && e.target;
    if (!sw || sw.state !== 'installed') return;
    if (navigator.serviceWorker.controller) {
      if (confirm('يتوفر تحديث للتطبيق. هل تريد إعادة تحميل الصفحة؟')) {
        sw.postMessage({ type: 'SKIP_WAITING' });
      }
    }
  }

  navigator.serviceWorker.addEventListener('controllerchange', function () {
    window.location.reload();
  });
})();
