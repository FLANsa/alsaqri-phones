// تحويل النصوص غير الموثوقة إلى نص آمن قبل إدخالها في قوالب HTML.
(function () {
  'use strict';

  window.escapeHTML = function escapeHTML(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };
})();
