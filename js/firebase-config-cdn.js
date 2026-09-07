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
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js';

// تهيئة التطبيق
const app = initializeApp(firebaseConfig);

// تهيئة الخدمات
const db = getFirestore(app);
const auth = getAuth(app);
const analytics = getAnalytics(app);

// تسجيل دخول مجهول تلقائي — قواعد Firestore تشترط request.auth != null
// إن ظهر خطأ auth/operation-not-approved (أو operation-not-allowed):
// فعّل مزوّد Anonymous من Firebase Console ← Authentication ← Sign-in method
signInAnonymously(auth).catch(function (err) {
  console.error(
    'تعذر تسجيل الدخول المجهول (' + (err && err.code) + '). ' +
    'فعّل مزوّد Anonymous في Firebase Console ← Authentication ← Sign-in method، ' +
    'وأضف نطاق الموقع إلى Authorized domains — وإلا سترفض قواعد Firestore كل قراءة وكتابة.',
    err
  );
});

// تصدير الخدمات للاستخدام في الملفات الأخرى
window.firebaseDB = db;
window.firebaseAuth = auth;
window.firebaseAnalytics = analytics;

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
