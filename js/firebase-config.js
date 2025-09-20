// Firebase Configuration for الصقري للاتصالات
// استبدل هذه القيم بقيم مشروعك من Firebase Console

const firebaseConfig = {
  apiKey: "AIzaSyB_MvtG7xnY5c18GybVF_SYJfxOa8mxgc8",
  authDomain: "alsaqri-dc3ca.firebaseapp.com",
  projectId: "alsaqri-dc3ca",
  storageBucket: "alsaqri-dc3ca.firebasestorage.app",
  messagingSenderId: "325709838350",
  appId: "1:325709838350:web:c3c5dfadc079ce825ae45f",
  measurementId: "G-Q8E93ZR4FZ"
};

// تهيئة Firebase
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// تهيئة التطبيق
const app = initializeApp(firebaseConfig);

// تهيئة الخدمات
const db = getFirestore(app);
const auth = getAuth(app);

// تصدير الخدمات للاستخدام في الملفات الأخرى
// هذه هي الطريقة الصحيحة لتعيين المتغيرات العامة
window.firebaseDB = db;
window.firebaseAuth = auth;

console.log('🔥 Firebase initialized successfully!');
console.log('📊 Firestore Database:', db);
console.log('🔐 Authentication:', auth);
