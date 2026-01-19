// Firebase Configuration for Phone Store Demo - CDN Version
// إعدادات Firebase لمشروع Al Saqri - نسخة CDN
// تم التحديث: 2026-01-19
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
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getAnalytics } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js';

// تهيئة التطبيق
const app = initializeApp(firebaseConfig);

// تهيئة الخدمات
const db = getFirestore(app);
const auth = getAuth(app);
const analytics = getAnalytics(app);

// تصدير الخدمات للاستخدام في الملفات الأخرى
window.firebaseDB = db;
window.firebaseAuth = auth;
window.firebaseAnalytics = analytics;

// تأكيد تحميل الإعدادات الصحيحة
console.log('🔥 Firebase initialized successfully!');
console.log('📌 Project ID:', firebaseConfig.projectId);
console.log('🌐 Auth Domain:', firebaseConfig.authDomain);
console.log('📊 Firestore Database:', db);
console.log('🔐 Authentication:', auth);
console.log('📈 Analytics:', analytics);

// تحذير إذا كان المشروع خاطئ
if (firebaseConfig.projectId !== 'alsaqri-dc3ca') {
  console.error('⚠️ تحذير: Project ID غير صحيح! يجب أن يكون alsaqri-dc3ca');
}
