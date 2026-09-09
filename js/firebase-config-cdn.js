// Firebase Configuration for Phone Store Demo - CDN Version
// إعدادات Firebase لمشروع Al Saqri - نسخة CDN
// تم التحديث: 2026-09-07
// Project: alsaqri-dc3ca

const firebaseConfig = {
  apiKey: "AIzaSyB_MvtG7xnY5c18GybVF_SYJfxOa8mxgc8",
  authDomain: "alsaqri-dc3ca.firebaseapp.com",
  projectId: "alsaqri-dc3ca",
  storageBucket: "alsaqri-dc3ca.firebasestorage.app",
  messagingSenderId: "325709838350",
  appId: "1:325709838350:web:c3c5dfadc079ce825ae45f",
  measurementId: "G-Q8E93ZR4FZ"
};

// تهيئة Firebase باستخدام CDN
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// تهيئة التطبيق
const app = initializeApp(firebaseConfig);

// تهيئة الخدمات
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
const auth = getAuth(app);

// تسجيل الدخول يحدث في login.html عبر Firebase Auth (حسابا admin/user).
// لا يوجد تسجيل مجهول — قواعد Firestore تشترط request.auth != null
// والجلسات الحقيقية فقط هي المقبولة.

// تصدير الخدمات للاستخدام في الملفات الأخرى
window.firebaseDB = db;
window.firebaseAuth = auth;
window.firebaseSignOut = signOut;

// إشعار موحد عندما يتعذر التحديث وتُعرض آخر لقطة محلية سليمة.
window.addEventListener('firebase-stale-cache', function (event) {
  if (document.getElementById('firebase-stale-cache-warning')) return;
  const warning = document.createElement('div');
  warning.id = 'firebase-stale-cache-warning';
  warning.className = 'alert alert-warning position-fixed top-0 start-50 translate-middle-x mt-2';
  warning.style.zIndex = '10000';
  const cachedAt = new Date(event.detail?.cachedAt || Date.now());
  warning.textContent = 'تعذر تحديث البيانات؛ المعروض نسخة محفوظة منذ ' + cachedAt.toLocaleString('ar-SA');
  document.body.appendChild(warning);
});

// كتم سجلات console.log في الإنتاج (console.error/warn تبقى ظاهرة).
// للتصحيح: نفّذ localStorage.setItem('__verbose', '1') ثم أعد تحميل الصفحة
try {
  if (localStorage.getItem('__verbose') !== '1') {
    console.log = function () {};
  }
} catch (_) {}

// تحذير إذا كان المشروع خاطئ
if (firebaseConfig.projectId !== 'alsaqri-dc3ca') {
  console.error('⚠️ تحذير: Project ID غير صحيح! يجب أن يكون alsaqri-dc3ca');
}
