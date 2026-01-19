// Firebase Configuration for Phone Store Demo - CDN Version
// إعدادات Firebase لمشروع AbdulMalik - نسخة CDN
// تم التحديث: 2026-01-19
// Project: abdulmalik-690c1

const firebaseConfig = {
  apiKey: "AIzaSyDmJqsMxCyfSUCWEUzeWWS4e7yT-e5FWKY",
  authDomain: "abdulmalik-690c1.firebaseapp.com",
  projectId: "abdulmalik-690c1",
  storageBucket: "abdulmalik-690c1.firebasestorage.app",
  messagingSenderId: "487683552497",
  appId: "1:487683552497:web:fd150711491f06a410e550",
  measurementId: "G-1BV2E5QQN1"
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
if (firebaseConfig.projectId !== 'abdulmalik-690c1') {
  console.error('⚠️ تحذير: Project ID غير صحيح! يجب أن يكون abdulmalik-690c1');
}
