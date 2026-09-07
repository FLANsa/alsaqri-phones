# JavaScript Architecture - الصقري للاتصالات

## 📁 الملفات الفعلية (2026-09-07)

```
js/
├── firebase-config-cdn.js        # تهيئة Firebase (CDN 10.7.1) + تسجيل دخول مجهول تلقائي
├── firebase-database-cdn.js      # طبقة Firestore الأساسية: كاش IndexedDB 5 دقائق،
│                                 # كتابات batch، قراءات موجّهة — window.firebaseDatabase
├── firebase-storage-manager.js   # واجهة موحّدة فوق طبقة Firestore — window.storage
│                                 # (مع فولباك localStorage عند تعذر Firebase فقط)
├── guard.js                      # حارس الصفحات حسب الدور (meta requires-role)
├── navigation.js                 # توليد القائمة العلوية حسب الدور — initNavigation()
├── arabic-numbers.js             # دعم الأرقام العربية (بعض الصفحات لها نسخ مضمّنة خاصة)
├── pwa-register.js               # تسجيل Service Worker والتحديث التلقائي
└── README.md                     # هذا الملف
```

## 🔌 واجهتا الوصول للبيانات

- **صفحات المتجر** (هواتف/أكسسوارات/مبيعات): تستخدم `window.storage.*`
- **صفحات الصيانة**: تستخدم `window.firebaseDatabase.*` مباشرة

الطبقتان لا تتعارضان — `firebase-storage-manager.js` يفوّض إلى `window.firebaseDatabase` عندما يكون متاحاً.

## 📄 ترتيب تضمين السكربتات في الصفحات

1. `js/firebase-config-cdn.js` — `type="module"` في `<head>` (يُحمَّل أولاً)
2. `js/firebase-database-cdn.js` — `type="module"` في `<head>`
3. `js/firebase-storage-manager.js` — `type="module"` في `<head>`
4. `js/guard.js` — في `<head>` (صفحات الصيانة الإدارية فقط، عبر `meta[name="requires-role"]`)
5. `js/arabic-numbers.js` و `js/navigation.js` و `js/pwa-register.js` — قبل `</body>`

## 🚀 التشغيل المحلي

```bash
python3 -m http.server 8000
# ثم افتح http://localhost:8000
```

## 🔧 ملاحظات

- كاش IndexedDB باسم `alsaqri_fs_cache` بعمر 5 دقائق لكل مجموعة.
- عند نفاد حصة Firestore يوجد قاطع دائرة 5 دقائق (انظر `firebase-database-cdn.js`).
- سجلات `console.log` مكتومة إنتاجياً؛ للتصحيح: `localStorage.setItem('__verbose','1')`.
- قواعد Firestore تشترط جلسة مسجلة (تسجيل دخول مجهول تلقائي) — راجع `firestore.rules`.
