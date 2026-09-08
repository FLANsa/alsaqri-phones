# الصقري للاتصالات

تطبيق ويب ثابت باللغة العربية لإدارة مخزون الهواتف والأكسسوارات والمبيعات والصيانة. يعتمد على Firebase Authentication وFirestore، ولا يحتوي على خادم تطبيق أو خطوة بناء.

## التشغيل المحلي

```bash
python3 -m http.server 8000
```

ثم افتح `http://localhost:8000`.

## Firebase

- إعدادات عميل الويب موجودة في `js/firebase-config-cdn.js`؛ مفتاح عميل Firebase علني بطبيعته، والحماية الفعلية في القواعد.
- فعّل تسجيل الدخول بطريقة Email/Password وأنشئ الحسابين المحددين في `js/guard.js`.
- لا تستخدم قواعد Firebase التجريبية. القواعد الحالية تقصر الوصول على حسابي التطبيق المعتمدين.
- انشر القواعد والفهارس والاستضافة بالأمر:

```bash
firebase deploy
```

## النشر

- إعداد Firebase Hosting موجود في `firebase.json`، ومجلد النشر هو جذر المشروع.
- `render.yaml` يعرّف Static Site من جذر المشروع. متغيرات البيئة لا تُستخدم لأن الملفات لا تمر بمرحلة بناء أو استبدال قيم.

## بنية المشروع

- صفحات المتجر والصيانة هي ملفات HTML الموجودة في الجذر.
- `js/firebase-database-cdn.js`: عمليات Firestore والمعاملات والكاش.
- `js/firebase-storage-manager.js`: واجهة بيانات صفحات المتجر مع توافق localStorage.
- `js/guard.js`: التحقق من جلسة Firebase ودور الحساب.
- `js/navigation.js`: القائمة المشتركة وتسجيل الخروج.
- `firestore.rules` و`storage.rules`: صلاحيات Firebase.

## التحقق قبل النشر

```bash
npm run build
git diff --check
```

بعد تعديل ملفات الموقع، ارفع إصدار `CACHE_NAME` في `sw.js` حتى تُزال النسخة القديمة من كاش PWA.
