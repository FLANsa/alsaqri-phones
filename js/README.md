# JavaScript Architecture - الصقري للاتصالات

## 📁 الملفات الفعلية (2026-09-08)

```
js/
├── firebase-config-cdn.js        # تهيئة Firebase (CDN 10.7.1) + تصدير الخدمات (Auth/DB/SignOut)
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

1. `js/firebase-config-cdn.js` — `type="module"` قبل طبقتي البيانات؛ بعض الصفحات تضع الثلاثة قبل نهاية `<body>`.
2. `js/firebase-database-cdn.js` — `type="module"` بعد التهيئة.
3. `js/firebase-storage-manager.js` — `type="module"` بعد المحرك لصفحات المتجر.
4. `js/guard.js` — في `<head>` لكل الصفحات المحمية الـ24، عبر `meta[name="requires-role"]`؛ يتطلب تهيئة Firebase Auth حتى في الصفحات التي لا تقرأ Firestore.
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
- الحماية: جلسة Firebase حقيقية (حسابا admin/user عبر login.html) + guard.js على كل الصفحات المحمية — راجع `firestore.rules`.

## سلامة عمليات المخزون

- إنشاء الهاتف وتعديله يحجزان مفاتيح `phone_keys` داخل معاملة؛ المفتاح SHA-256 للتسلسل/الباركود بعد توحيد الأرقام والمسافات وحالة الأحرف.
- `counters/phone_keys.ready` يؤكد تجهيز مراجع السجلات القديمة؛ غيابه يوقف حفظ الهاتف بدلاً من تجاوز فحص التفرد.
- العداد المركزي يزيد ويُقرأ في معاملة واحدة، ولا يرجع رقماً محلياً عند فشل الشبكة.
- البيع والاسترجاع معاملتان ذريتان؛ البيع يرفض الهاتف المكرر أو المباع والكمية غير المتاحة. `operation_id` يمنع تكرار البيع عند إعادة المحاولة.
- استرجاع الفاتورة يقرأ الحالة الحالية والمخزون داخل المعاملة، ويرفض تعارض إعادة شراء الهاتف.
- القواعد ما زالت تشترط المصادقة فقط: الحماية الذرية هنا تخص مسارات التطبيق، ولا تمنع مستخدماً مصادقاً من تجاوزها عبر SDK مباشر.
- الكاش يجمع القراءات المتزامنة ويخزن النتيجة الفارغة المؤكدة من الخادم. `_reads` عداد تشخيصي للطلبات والمستندات المعادة، وليس فاتورة قراءات Firebase.
